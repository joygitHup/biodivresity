"""识别服务侧接口：数据接入、任务查询/重试、运行统计与健康检查。"""
from __future__ import annotations

import logging
import os
from datetime import timedelta

from django.conf import settings
from django.db.models import Avg, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.devices.models import Device
from apps.survey_areas.models import SurveyArea

from common.permissions import IsAdminOrStaff

from .auth import EdgeDeviceTokenAuthentication
from .models import MediaAsset, PredictionTask, ThresholdAudit
from .providers import get_provider
from .serializers import (
    EdgeReportSerializer,
    IngestOptionsSerializer,
    MediaAssetSerializer,
    PredictionTaskDetailSerializer,
    PredictionTaskListSerializer,
    ThresholdAuditSerializer,
)
from .services import (
    backlog_count,
    create_asset_from_upload,
    dispatch_task,
    report_edge_result,
    scheduling_stats,
)

logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 单文件 10MB

AUDIO_TYPES = {"audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/flac", "audio/ogg"}
VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/x-msvideo", "video/avi"}
AUDIO_EXTS = {".wav", ".mp3", ".flac", ".ogg", ".m4a"}
VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv"}


def _infer_source_type(content_type: str, filename: str = "") -> str:
    content_type = (content_type or "").lower()
    if content_type in AUDIO_TYPES or content_type.startswith("audio/"):
        return MediaAsset.SourceType.AUDIO
    if content_type in VIDEO_TYPES or content_type.startswith("video/"):
        return MediaAsset.SourceType.VIDEO

    # 设备常以 application/octet-stream 推送，回退到扩展名判断
    ext = os.path.splitext(filename or "")[1].lower()
    if ext in AUDIO_EXTS:
        return MediaAsset.SourceType.AUDIO
    if ext in VIDEO_EXTS:
        return MediaAsset.SourceType.VIDEO
    return MediaAsset.SourceType.IMAGE


class IngestView(APIView):
    """接收设备/边缘网关推送的媒体文件，落盘后自动创建识别任务。"""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(summary="媒体数据接入（支持多文件）", request=IngestOptionsSerializer)
    def post(self, request):
        files = request.FILES.getlist("files") or request.FILES.getlist("file")
        if not files:
            return Response(
                {"code": 40001, "message": "请上传至少一个文件（字段名 file 或 files）"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        options = IngestOptionsSerializer(data=request.data)
        options.is_valid(raise_exception=True)
        data = options.validated_data

        device = None
        if data.get("device"):
            device = get_object_or_404(Device, pk=data["device"])

        survey_area = None
        if data.get("survey_area"):
            survey_area = get_object_or_404(SurveyArea, pk=data["survey_area"])

        items = []
        accepted = duplicates = skipped = 0
        for upload in files:
            if upload.size > MAX_FILE_SIZE:
                items.append({"filename": upload.name, "status": "rejected",
                              "reason": "文件超过 10MB"})
                skipped += 1
                continue

            source_type = data.get("source_type") or _infer_source_type(
                upload.content_type, upload.name,
            )
            asset, task, reason = create_asset_from_upload(
                upload,
                source_type=source_type,
                device=device,
                survey_area=survey_area,
                captured_at=data.get("captured_at"),
                quality_score=data.get("quality_score"),
                burst_group=data.get("burst_group", ""),
                uploader=request.user,
            )

            if task and task.status == PredictionTask.Status.PENDING:
                dispatch_task(task)
                accepted += 1
            elif reason == "duplicate":
                duplicates += 1
            else:
                skipped += 1

            items.append({
                "filename": upload.name,
                "asset_id": asset.id,
                "task_id": task.id if task else None,
                "request_id": task.request_id if task else None,
                "source_type": source_type,
                "quality_status": asset.quality_status,
                "status": task.status if task else "skipped",
                "reason": reason,
            })

        return Response({
            "code": 0,
            "message": "ok",
            "data": {
                "accepted": accepted,
                "duplicate": duplicates,
                "skipped": skipped,
                "items": items,
            },
        }, status=status.HTTP_201_CREATED)


@extend_schema_view(
    list=extend_schema(summary="识别任务列表"),
    retrieve=extend_schema(summary="识别任务详情"),
)
class PredictionTaskViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PredictionTask.objects.select_related(
        "asset", "asset__device", "asset__survey_area", "model",
    ).all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = {
        "status": ["exact", "in"],
        "task_type": ["exact"],
        "provider": ["exact"],
        "is_gray": ["exact"],
        "tier": ["exact"],
        "escalated": ["exact"],
        "escalation_reason": ["exact"],
        "decided_by": ["exact"],
        "asset__device": ["exact"],
        "asset__survey_area": ["exact"],
        "created_at": ["gte", "lte"],
        "attempts": ["gte"],
    }
    search_fields = ["request_id", "error_code", "asset__sha256"]
    ordering_fields = ["created_at", "latency_ms", "attempts", "finished_at"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PredictionTaskDetailSerializer
        return PredictionTaskListSerializer

    @extend_schema(summary="重新投递失败任务（异步）")
    @action(detail=True, methods=["post"], permission_classes=[IsAdminOrStaff])
    def retry(self, request, pk=None):
        task = self.get_object()
        if task.status == PredictionTask.Status.SUCCEEDED:
            return Response({"code": 40002, "message": "任务已成功，无需重试"},
                            status=status.HTTP_400_BAD_REQUEST)
        if task.status == PredictionTask.Status.RUNNING:
            return Response({"code": 40002, "message": "任务正在执行中"},
                            status=status.HTTP_400_BAD_REQUEST)
        # 异步投递 — HTTP 请求立即返回，DB 重置 + Celery 投递在后台执行
        from .tasks import retry_task_async
        retry_task_async.delay(task.pk)
        return Response({
            "code": 0, "message": "ok",
            "data": {
                "task_id": task.pk,
                "request_id": task.request_id,
                "status": "queued",
                "message": "已加入异步重试队列，稍后自动执行",
            },
        })


@extend_schema_view(
    list=extend_schema(summary="媒体资产列表"),
    retrieve=extend_schema(summary="媒体资产详情"),
)
class MediaAssetViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MediaAsset.objects.select_related(
        "device", "survey_area", "uploaded_by",
    ).all()
    serializer_class = MediaAssetSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = {
        "source_type": ["exact"],
        "quality_status": ["exact"],
        "reliability_grade": ["exact"],
        "is_rejected": ["exact"],
        "device": ["exact"],
        "survey_area": ["exact"],
        "reliability_score": ["gte", "lt"],
        "created_at": ["gte", "lte"],
    }
    search_fields = ["sha256", "burst_group"]
    ordering_fields = ["created_at", "size", "quality_score", "reliability_score"]
    ordering = ["-created_at"]


class InferenceStatsView(APIView):
    """识别服务运行统计，供看板与运维排查使用。"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = now - timedelta(days=7)

        counts = {
            row["status"]: row["count"]
            for row in PredictionTask.objects.values("status").annotate(count=Count("id"))
        }
        succeeded = counts.get(PredictionTask.Status.SUCCEEDED, 0)
        failed = counts.get(PredictionTask.Status.FAILED, 0)
        finished = succeeded + failed

        by_type = {
            row["task_type"]: row["count"]
            for row in PredictionTask.objects.values("task_type").annotate(count=Count("id"))
        }
        errors = list(
            PredictionTask.objects.filter(status=PredictionTask.Status.FAILED,
                                          created_at__gte=week_ago)
            .exclude(error_code="")
            .values("error_code")
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )
        avg_latency = PredictionTask.objects.filter(
            status=PredictionTask.Status.SUCCEEDED, finished_at__gte=week_ago,
        ).aggregate(value=Avg("latency_ms"))["value"]

        audio_qs = MediaAsset.objects.filter(source_type=MediaAsset.SourceType.AUDIO)
        audio_counts = {
            row["reliability_grade"]: row["count"]
            for row in audio_qs.exclude(reliability_grade="")
            .values("reliability_grade").annotate(count=Count("id"))
        }
        audio_avg = audio_qs.aggregate(value=Avg("reliability_score"))["value"]

        return Response({
            "code": 0,
            "message": "ok",
            "data": {
                "totalTasks": sum(counts.values()),
                "pending": counts.get(PredictionTask.Status.PENDING, 0),
                "running": counts.get(PredictionTask.Status.RUNNING, 0),
                "succeeded": succeeded,
                "failed": failed,
                "skipped": counts.get(PredictionTask.Status.SKIPPED, 0),
                "successRate": round(succeeded / finished * 100, 2) if finished else 0,
                "avgLatencyMs": round(avg_latency, 1) if avg_latency else 0,
                "retriedTasks": PredictionTask.objects.filter(attempts__gt=1).count(),
                "grayTasks": PredictionTask.objects.filter(is_gray=True).count(),
                "todayIngested": MediaAsset.objects.filter(created_at__gte=today).count(),
                "todaySucceeded": PredictionTask.objects.filter(
                    status=PredictionTask.Status.SUCCEEDED, finished_at__gte=today,
                ).count(),
                "backlog": backlog_count(),
                "backlogThreshold": getattr(settings, "INFERENCE_BACKLOG_THRESHOLD", 500),
                "byTaskType": by_type,
                "audioReliability": {
                    "total": sum(audio_counts.values()),
                    "reliable": audio_counts.get(MediaAsset.ReliabilityGrade.RELIABLE, 0),
                    "degraded": audio_counts.get(MediaAsset.ReliabilityGrade.DEGRADED, 0),
                    "unreliable": audio_counts.get(MediaAsset.ReliabilityGrade.UNRELIABLE, 0),
                    "avgScore": round(audio_avg, 3) if audio_avg is not None else None,
                },
                "topErrors": errors,
            },
        })


class ProviderHealthView(APIView):
    """推理后端健康检查，便于快速判断是平台还是模型服务的问题。"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .providers import get_edge_provider

        provider = get_provider()
        try:
            health = provider.health()
        except Exception as exc:
            logger.warning("推理后端健康检查失败", exc_info=True)
            health = {"status": "error", "provider": provider.name, "detail": str(exc)}
        try:
            edge_health = get_edge_provider().health()
        except Exception as exc:
            edge_health = {"status": "error", "provider": "edge", "detail": str(exc)}
        return Response({"code": 0, "message": "ok",
                         "data": {**health, "edge": edge_health}})


class EdgeReportView(APIView):
    """边缘网关上报轻量模型结果：平台按策略直判或回补云端。

    鉴权方式（二选一）：
    - 管理端测试：JWT Bearer Token
    - 边缘网关：X-Device-Token 请求头（设备级 Token）
    """

    authentication_classes = [JWTAuthentication, EdgeDeviceTokenAuthentication]
    permission_classes = []

    @extend_schema(summary="边缘识别结果上报", request=EdgeReportSerializer)
    def post(self, request):
        # 设备 Token 认证：确保资产属于该设备
        device = getattr(request, "device", None)
        if device is None and not (request.user and request.user.is_authenticated):
            return Response({"code": 40101, "message": "需要 JWT 或设备 Token 鉴权"},
                            status=status.HTTP_401_UNAUTHORIZED)

        serializer = EdgeReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        asset = get_object_or_404(MediaAsset, pk=data["asset_id"])
        if asset.source_type == MediaAsset.SourceType.EDNA:
            return Response({"code": 40002, "message": "eDNA 资产不进入识别调度"},
                            status=status.HTTP_400_BAD_REQUEST)

        # 设备 Token 模式下，仅允许上报本设备的资产
        if device is not None and asset.device_id != device.id:
            return Response({"code": 40301, "message": "该资产不属于当前设备"},
                            status=status.HTTP_403_FORBIDDEN)

        outcome = report_edge_result(
            asset,
            {
                "top_k": data["top_k"],
                "model_version": data.get("model_version", ""),
                "quality_flag": data.get("quality_flag", ""),
                "noise_ratio": data.get("noise_ratio", 0.0),
                "separation_quality": data.get("separation_quality"),
            },
            provider=data.get("provider") or "edge",
            latency_ms=data.get("latency_ms", 0),
        )
        decision = outcome.get("decision")
        message = {
            "accepted": "边缘直判完成",
            "escalated": "已转云端复核",
            "ignored": "任务已完成，忽略本次上报",
        }.get(decision, "ok")
        return Response({"code": 0, "message": message, "data": outcome},
                        status=status.HTTP_201_CREATED)


class SchedulingStatsView(APIView):
    """两级调度运行统计：边缘直判、上云原因、云端预算与一致性。"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            days = int(request.query_params.get("days", 7))
        except (TypeError, ValueError):
            days = 7
        return Response({"code": 0, "message": "ok", "data": scheduling_stats(days=max(days, 1))})


@extend_schema_view(list=extend_schema(summary="复核阈值变更记录"))
class ThresholdAuditListView(generics.ListAPIView):
    """阈值变更留痕，支持按物种过滤。"""

    queryset = ThresholdAudit.objects.select_related("species", "operator").all()
    serializer_class = ThresholdAuditSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {"species": ["exact"], "operator": ["exact"],
                        "created_at": ["gte", "lte"]}
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]
