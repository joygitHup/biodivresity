import uuid
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiParameter
from django.conf import settings

from .models import RecognizeRecord
from .serializers import (
    RecognizeRequestSerializer,
    RecognizeResponseSerializer,
    RecognizeRecordListSerializer,
    RecognizeRecordDetailSerializer,
)
from .services import _mock_inference
from common.pagination import StandardPagination

ALLOWED_IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp")
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB


class RecognizeView(APIView):
    """上传图像并执行病虫害识别."""
    permission_classes = [AllowAny]

    @extend_schema(
        summary="病虫害识别",
        request={"multipart/form-data": RecognizeRequestSerializer},
        responses={200: RecognizeResponseSerializer},
    )
    def post(self, request):
        # Validate image presence
        image = request.FILES.get("image")
        if not image:
            return Response(
                {"code": 40001, "message": "缺少图像文件"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate size
        if image.size > MAX_IMAGE_SIZE:
            return Response(
                {"code": 40001, "message": "图像大小不能超过 10MB"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate type via content_type + try decode with Pillow
        content_type = image.content_type or ""
        if content_type not in ALLOWED_IMAGE_TYPES:
            return Response(
                {"code": 40001, "message": f"不支持的图像格式: {content_type}，仅支持 JPG/PNG/WebP"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from PIL import Image
            img = Image.open(image)
            img.verify()
            image.seek(0)
        except Exception:
            return Response(
                {"code": 40001, "message": "图像文件损坏或无法解码"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Run inference (mock for now)
        image_bytes = image.read()
        result = _mock_inference(image_bytes)
        request_id = f"req_{uuid.uuid4().hex[:16]}"

        # Save record
        record = RecognizeRecord.objects.create(
            user=request.user if request.user.is_authenticated else None,
            image=image if request.user.is_authenticated else None,
            top_category_id=result.top_k[0]["category_id"],
            top_category_name=result.top_k[0]["name"],
            top_confidence=result.top_k[0]["confidence"],
            top5_result=result.top_k,
            rejected=result.rejected,
            model_version=result.model_version,
            request_id=request_id,
        )

        disclaimer = "识别结果仅供参考，重大病虫害请以农技部门诊断为准"

        return Response({
            "code": 0,
            "message": "ok",
            "data": {
                "request_id": request_id,
                "model_version": result.model_version,
                "top_k": result.top_k,
                "rejected": result.rejected,
                "advisory": result.advisory,
                "disclaimer": disclaimer,
            },
        })


class RecognizeRecordListView(APIView):
    """当前用户的识别历史列表."""

    def get(self, request):
        records = RecognizeRecord.objects.filter(user=request.user).order_by("-created_at")
        paginator = StandardPagination()
        page = paginator.paginate_queryset(records, request)
        serializer = RecognizeRecordListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class RecognizeRecordDetailView(APIView):
    """识别历史详情."""

    def get(self, request, pk):
        record = RecognizeRecord.objects.filter(pk=pk, user=request.user).first()
        if not record:
            return Response(
                {"code": 40401, "message": "记录不存在"},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = RecognizeRecordDetailSerializer(record)
        return Response({"code": 0, "message": "ok", "data": serializer.data})
