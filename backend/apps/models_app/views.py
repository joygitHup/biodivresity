from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema_view, extend_schema
from apps.users.mixins import AuditModelViewSetMixin

from .models import ModelVersion
from .serializers import ModelVersionListSerializer, ModelVersionDetailSerializer, ModelVersionWriteSerializer
from common.permissions import IsAdminRole


@extend_schema_view(
    list=extend_schema(summary="模型版本列表"),
    retrieve=extend_schema(summary="模型版本详情"),
    create=extend_schema(summary="上传模型版本(管理员)"),
)
class ModelVersionViewSet(AuditModelViewSetMixin, viewsets.ModelViewSet):
    queryset = ModelVersion.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "is_active", "task_type", "deploy_scope", "tier"]
    search_fields = ["name", "version"]
    ordering_fields = ["created_at", "top1_accuracy", "inference_count"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return ModelVersionListSerializer
        if self.action == "retrieve":
            return ModelVersionDetailSerializer
        return ModelVersionWriteSerializer

    def create(self, request, *args, **kwargs):
        # 输入用 WriteSerializer 校验，输出用 DetailSerializer 返回完整对象（含 id）
        serializer = ModelVersionWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            ModelVersionDetailSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = ModelVersionWriteSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        target_status = serializer.validated_data.get("status", instance.status)
        target_ratio = serializer.validated_data.get("traffic_ratio", instance.traffic_ratio)
        # 发布门禁：灰度(比例>0)或进入稳定/线上状态前，训练报告必须审批通过
        if target_ratio and target_ratio > 0 or target_status in (
            ModelVersion.Status.STABLE, ModelVersion.Status.ACTIVE,
        ):
            from apps.training.services import publish_gate_error
            error = publish_gate_error(instance)
            if error:
                return Response({"code": 40302, "message": error},
                                status=status.HTTP_403_FORBIDDEN)
        self.perform_update(serializer)
        return Response(ModelVersionDetailSerializer(instance).data)

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "activate", "rollback"]:
            return [IsAdminRole()]
        return super().get_permissions()

    @extend_schema(summary="激活为线上版本(管理员)")
    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        model_version = self.get_object()
        if model_version.status == ModelVersion.Status.STOPPED:
            return Response({"code": 40002, "message": "已停用的模型不能激活"},
                            status=status.HTTP_400_BAD_REQUEST)
        # 发布门禁：训练产出的模型必须有审批通过的报告
        from apps.training.services import publish_gate_error
        error = publish_gate_error(model_version)
        if error:
            return Response({"code": 40302, "message": error},
                            status=status.HTTP_403_FORBIDDEN)
        with transaction.atomic():
            ModelVersion.objects.filter(is_active=True).update(is_active=False, status=ModelVersion.Status.STABLE)
            model_version.is_active = True
            model_version.status = ModelVersion.Status.ACTIVE
            model_version.save()
        return Response({"code": 0, "message": "ok", "data": {"version": model_version.version, "is_active": True}})

    @extend_schema(summary="回滚至上一个稳定版本(管理员)")
    @action(detail=False, methods=["post"])
    def rollback(self, request):
        previous = ModelVersion.objects.filter(status=ModelVersion.Status.STABLE).order_by("-created_at").first()
        if not previous:
            return Response({"code": 40401, "message": "没有可回滚的稳定版本"}, status=status.HTTP_404_NOT_FOUND)
        with transaction.atomic():
            ModelVersion.objects.filter(is_active=True).update(is_active=False, status=ModelVersion.Status.STABLE)
            previous.is_active = True
            previous.status = ModelVersion.Status.ACTIVE
            previous.save()
        return Response({"code": 0, "message": "ok", "data": {"version": previous.version}})
