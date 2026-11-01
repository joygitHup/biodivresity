"""训练任务与报告审批接口。"""
from __future__ import annotations

import logging

from django.core.files.storage import default_storage
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.records.models import TrainingSample
from apps.records.services import config_bool, config_int
from apps.users.audit import audit_action
from common.permissions import IsAdminOrStaff

from .models import TrainingReport, TrainingRun
from .serializers import (
    TrainingReportSerializer,
    TrainingRunCreateSerializer,
    TrainingRunDetailSerializer,
    TrainingRunListSerializer,
)
from .services import (
    approval_level,
    build_report_html,
    final_approve_report,
    generate_pdf,
    is_reviewer_allowed,
    reject_report,
    report_stats,
    review_report,
    submit_report,
)
from .tasks import run_training

logger = logging.getLogger(__name__)

DEFAULT_MODEL_FAMILY = {
    TrainingRun.MediaType.IMAGE: "yolo",
    TrainingRun.MediaType.VIDEO: "yolo",
    TrainingRun.MediaType.AUDIO: "panns",
}


def _enqueue(run: TrainingRun) -> None:
    """投递训练任务；Broker 不可用时同步执行，避免任务悬空。"""
    try:
        result = run_training.delay(run.id)
        run.celery_task_id = getattr(result, "id", "") or ""
        run.save(update_fields=["celery_task_id"])
    except Exception:  # noqa: BLE001
        logger.warning("训练任务投递失败，改为同步执行 run=%s", run.id)
        run_training(run.id)


def _eligible_count(media_type: str, filters: dict) -> int:
    qs = TrainingSample.objects.filter(
        status__in=(TrainingSample.Status.READY, TrainingSample.Status.EXPORTED),
        label__isnull=False,
    )
    if media_type:
        qs = qs.filter(media_type=media_type)
    sources = filters.get("label_sources") or []
    if sources:
        qs = qs.filter(label_source__in=sources)
    min_conf = filters.get("min_confidence")
    if min_conf:
        qs = qs.filter(confidence__gte=float(min_conf))
    if filters.get("exclude_quality"):
        qs = qs.exclude(quality_flag__gt="")
    return qs.count()


@extend_schema_view(
    list=extend_schema(summary="训练任务列表"),
    retrieve=extend_schema(summary="训练任务详情"),
    create=extend_schema(summary="发起训练任务(管理员/农技人员)"),
)
class TrainingRunViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = TrainingRun.objects.select_related(
        "snapshot", "submitted_by", "target_model_version",
    ).prefetch_related("reports")
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["status", "media_type", "model_family"]
    ordering_fields = ["created_at", "finished_at"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return TrainingRunDetailSerializer
        if self.action == "create":
            return TrainingRunCreateSerializer
        return TrainingRunListSerializer

    def get_permissions(self):
        if self.action in ("create", "retry", "cancel"):
            return [IsAdminOrStaff()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        if not config_bool("training_enabled", True):
            return Response({"code": 40002, "message": "模型训练功能已关闭"},
                            status=status.HTTP_400_BAD_REQUEST)

        serializer = TrainingRunCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        filters = {
            "label_sources": data.get("label_sources") or [],
            "min_confidence": data.get("min_confidence") or 0,
            "exclude_quality": data.get("exclude_quality") or False,
        }
        count = _eligible_count(data["media_type"], filters)
        min_samples = max(config_int("training_min_samples", 20), 1)
        if count < min_samples:
            return Response(
                {"code": 40002, "message": f"可用样本 {count} 条，低于发起训练的最低要求 {min_samples} 条"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        run = TrainingRun.objects.create(
            media_type=data["media_type"],
            model_family=data.get("model_family") or DEFAULT_MODEL_FAMILY.get(data["media_type"], "yolo"),
            filters=filters,
            hyperparams={
                "epochs": data.get("epochs") or 30,
                "batch_size": data.get("batch_size") or 16,
                "learning_rate": data.get("learning_rate") or 0.001,
            },
            submitted_by=request.user,
        )
        _enqueue(run)
        audit_action(
            request, "create",
            target_type="training_run", target_id=run.id,
            target_label=f"训练任务#{run.id}",
            detail=f"发起训练：{run.get_media_type_display()} {run.model_family}，可用样本 {count} 条",
        )
        run.refresh_from_db()
        return Response(
            {"code": 0, "message": "ok", "data": TrainingRunDetailSerializer(run, context={"request": request}).data},
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(summary="重试训练任务(管理员/农技人员)")
    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        run = self.get_object()
        if run.status not in (TrainingRun.Status.FAILED, TrainingRun.Status.CANCELLED):
            return Response({"code": 40002, "message": "仅失败或已取消的任务可重试"},
                            status=status.HTTP_400_BAD_REQUEST)
        run.status = TrainingRun.Status.QUEUED
        run.error_message = ""
        run.report_ready = False
        run.save(update_fields=["status", "error_message", "report_ready"])
        _enqueue(run)
        audit_action(request, "update", target_type="training_run", target_id=run.id,
                     target_label=f"训练任务#{run.id}", detail="重试训练任务")
        run.refresh_from_db()
        return Response({"code": 0, "message": "ok",
                         "data": TrainingRunDetailSerializer(run, context={"request": request}).data})

    @extend_schema(summary="取消训练任务(管理员/农技人员)")
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        run = self.get_object()
        if run.status not in (TrainingRun.Status.QUEUED, TrainingRun.Status.RUNNING):
            return Response({"code": 40002, "message": "当前状态不可取消"},
                            status=status.HTTP_400_BAD_REQUEST)
        run.status = TrainingRun.Status.CANCELLED
        run.save(update_fields=["status"])
        audit_action(request, "update", target_type="training_run", target_id=run.id,
                     target_label=f"训练任务#{run.id}", detail="取消训练任务")
        return Response({"code": 0, "message": "ok", "data": {"id": run.id, "status": run.status}})

    @extend_schema(summary="训练与审批统计")
    @action(detail=False, methods=["get"])
    def stats(self, request):
        counts = {key: TrainingRun.objects.filter(status=key).count() for key, _ in TrainingRun.Status.choices}
        total = TrainingRun.objects.count()
        succeeded = counts.get(TrainingRun.Status.SUCCEEDED, 0)
        data = {
            "totalRuns": total,
            "runsByStatus": counts,
            "succeededRuns": succeeded,
            "successRate": round(succeeded / total, 4) if total else 0,
            **report_stats(),
            "trainingEnabled": config_bool("training_enabled", True),
            "minSamples": config_int("training_min_samples", 20),
            "approvalLevel": "dual" if approval_level() >= 2 else "single",
        }
        return Response({"code": 0, "message": "ok", "data": data})


@extend_schema_view(
    list=extend_schema(summary="训练报告列表"),
    retrieve=extend_schema(summary="训练报告详情"),
)
class TrainingReportViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = TrainingReport.objects.select_related(
        "run", "submitted_by", "reviewed_by", "approved_by",
    )
    serializer_class = TrainingReportSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["status", "run"]
    ordering_fields = ["created_at", "generated_at"]
    ordering = ["-created_at"]

    def _bad(self, message):
        return Response({"code": 40002, "message": message}, status=status.HTTP_400_BAD_REQUEST)

    def _forbidden(self, message):
        return Response({"code": 40301, "message": message}, status=status.HTTP_403_FORBIDDEN)

    @extend_schema(summary="提交报告审批")
    @action(detail=True, methods=["post"], permission_classes=[IsAdminOrStaff])
    def submit(self, request, pk=None):
        report = self.get_object()
        try:
            submit_report(report, request.user, request.data.get("remark", ""))
        except ValueError as exc:
            return self._bad(str(exc))
        except PermissionError as exc:
            return self._forbidden(str(exc))
        audit_action(request, "update", target_type="training_report", target_id=report.id,
                     target_label=f"训练报告#{report.id}", detail="提交报告审批")
        report.refresh_from_db()
        return Response({"code": 0, "message": "ok",
                         "data": TrainingReportSerializer(report, context={"request": request}).data})

    @extend_schema(summary="一级审核通过")
    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        report = self.get_object()
        if not is_reviewer_allowed(request.user):
            return self._forbidden("当前用户不在训练报告审批人范围内")
        try:
            review_report(report, request.user, request.data.get("comment", ""))
        except ValueError as exc:
            return self._bad(str(exc))
        except PermissionError as exc:
            return self._forbidden(str(exc))
        audit_action(request, "review", target_type="training_report", target_id=report.id,
                     target_label=f"训练报告#{report.id}", detail="一级审核通过")
        report.refresh_from_db()
        return Response({"code": 0, "message": "ok",
                         "data": TrainingReportSerializer(report, context={"request": request}).data})

    @extend_schema(summary="终审通过")
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        report = self.get_object()
        try:
            final_approve_report(report, request.user, request.data.get("comment", ""))
        except ValueError as exc:
            return self._bad(str(exc))
        except PermissionError as exc:
            return self._forbidden(str(exc))
        audit_action(request, "review", target_type="training_report", target_id=report.id,
                     target_label=f"训练报告#{report.id}", detail="终审通过，模型版本可发布")
        report.refresh_from_db()
        return Response({"code": 0, "message": "ok",
                         "data": TrainingReportSerializer(report, context={"request": request}).data})

    @extend_schema(summary="驳回训练报告")
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        report = self.get_object()
        try:
            reject_report(report, request.user, request.data.get("comment", ""))
        except ValueError as exc:
            return self._bad(str(exc))
        except PermissionError as exc:
            return self._forbidden(str(exc))
        audit_action(request, "review", target_type="training_report", target_id=report.id,
                     target_label=f"训练报告#{report.id}", detail="驳回训练报告")
        report.refresh_from_db()
        return Response({"code": 0, "message": "ok",
                         "data": TrainingReportSerializer(report, context={"request": request}).data})

    @extend_schema(summary="在线查看报告HTML")
    @action(detail=True, methods=["get"])
    def html(self, request, pk=None):
        report = self.get_object()
        content = None
        if report.html_path:
            try:
                with default_storage.open(report.html_path, "rb") as fh:
                    content = fh.read()
            except Exception:  # noqa: BLE001
                content = None
        if content is None:
            report.run.refresh_from_db()
            content = build_report_html(report.run, report).encode("utf-8")
        return HttpResponse(content, content_type="text/html; charset=utf-8")

    @extend_schema(summary="下载报告PDF")
    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        report = self.get_object()
        content = None
        if report.pdf_path:
            try:
                with default_storage.open(report.pdf_path, "rb") as fh:
                    content = fh.read()
            except Exception:  # noqa: BLE001
                content = None
        if content is None:
            path = generate_pdf(report)
            if path:
                report.pdf_path = path
                report.save(update_fields=["pdf_path"])
                with default_storage.open(path, "rb") as fh:
                    content = fh.read()
        if content is None:
            return Response(
                {"code": 40402, "message": "PDF 尚未生成（未检测到可用浏览器或生成失败），请先在线查看报告"},
                status=status.HTTP_404_NOT_FOUND,
            )
        response = HttpResponse(content, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="training_report_run{report.run_id}_r{report.revision}.pdf"'
        )
        return response
