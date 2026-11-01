from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from django.core.files.storage import default_storage
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema_view, extend_schema
from apps.users.mixins import AuditModelViewSetMixin
from common.permissions import IsAdminOrStaff
from .models import Species
from .serializers import (
    SpeciesListSerializer,
    SpeciesDetailSerializer,
    SpeciesWriteSerializer,
)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_SIZE = 10 * 1024 * 1024  # 10MB


@extend_schema_view(
    list=extend_schema(summary="物种列表"),
    retrieve=extend_schema(summary="物种详情"),
    create=extend_schema(summary="创建物种"),
    update=extend_schema(summary="更新物种"),
    partial_update=extend_schema(summary="部分更新物种"),
    destroy=extend_schema(summary="删除物种"),
)
class SpeciesViewSet(AuditModelViewSetMixin, viewsets.ModelViewSet):
    queryset = Species.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["category", "protection_level", "iucn_status"]
    search_fields = ["chinese_name", "latin_name"]
    ordering_fields = ["record_count", "created_at"]
    ordering = ["-record_count"]

    def get_serializer_class(self):
        if self.action == "list":
            return SpeciesListSerializer
        if self.action == "retrieve":
            return SpeciesDetailSerializer
        return SpeciesWriteSerializer

    def create(self, request, *args, **kwargs):
        # 输入用 WriteSerializer 校验，输出用 DetailSerializer 返回完整对象（含 id）
        serializer = SpeciesWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            SpeciesDetailSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        old_threshold = instance.review_threshold
        serializer = SpeciesWriteSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # 阈值变更留痕，便于追溯复核标准调整
        if old_threshold != instance.review_threshold:
            from apps.inference.models import ThresholdAudit
            ThresholdAudit.objects.create(
                species=instance,
                old_value=old_threshold,
                new_value=instance.review_threshold,
                operator=request.user if request.user.is_authenticated else None,
            )

        return Response(SpeciesDetailSerializer(instance).data)

    @extend_schema(summary="上传/更新物种照片")
    @action(
        detail=True, methods=["post"],
        parser_classes=[MultiPartParser, FormParser],
        permission_classes=[IsAuthenticated, IsAdminOrStaff],
    )
    def photo(self, request, pk=None):
        """接收图片文件，存入 MinIO，并把访问地址写回 species.image_url。"""
        species = self.get_object()
        upload = request.FILES.get("file") or request.FILES.get("photo")
        if not upload:
            return Response({"code": 40001, "message": "缺少图片文件(file)"},
                            status=status.HTTP_400_BAD_REQUEST)
        if upload.content_type not in ALLOWED_IMAGE_TYPES:
            return Response({"code": 40002, "message": "仅支持 JPG/PNG/WebP 图片"},
                            status=status.HTTP_400_BAD_REQUEST)
        if upload.size > MAX_PHOTO_SIZE:
            return Response({"code": 40003, "message": "图片不能超过 10MB"},
                            status=status.HTTP_400_BAD_REQUEST)

        # 校验文件确实是可解码的图片，避免伪装文件
        try:
            from PIL import Image
            Image.open(upload).verify()
            upload.seek(0)
        except Exception:
            return Response({"code": 40004, "message": "无法识别的图片文件"},
                            status=status.HTTP_400_BAD_REQUEST)

        ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[
            upload.content_type
        ]
        from uuid import uuid4

        key = f"species/{species.id}/{uuid4().hex}{ext}"
        saved_name = default_storage.save(key, upload)
        url = default_storage.url(saved_name)

        # 替换旧照片时清理对象存储中的历史文件（仅限 species/ 前缀）
        old_url = species.image_url
        species.image_url = url
        species.save(update_fields=["image_url", "updated_at"])
        bucket = getattr(settings, "MINIO_BUCKET", "")
        if old_url and old_url != url and bucket and f"/{bucket}/" in old_url:
            old_key = old_url.split(f"/{bucket}/", 1)[1]
            if old_key.startswith("species/"):
                try:
                    default_storage.delete(old_key)
                except Exception:
                    pass

        return Response({
            "code": 0,
            "message": "照片已上传",
            "data": {"image_url": url, "id": species.id},
        })
