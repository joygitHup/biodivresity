import csv
import io
import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from datetime import date

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, status, renderers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema_view, extend_schema

from apps.species.models import Species
from common.storage_utils import local_copy
from .models import MonitorRecord, TrainingSample
from .serializers import (
    MonitorRecordListSerializer,
    MonitorRecordDetailSerializer,
    MonitorRecordWriteSerializer,
    TrainingSampleSerializer,
)
from .services import (
    effective_threshold, needs_review, risk_priority, HIGH_RISK_LEVELS,
    config_bool, config_float,
)
from common.permissions import IsAdminOrStaff


class PassthroughRenderer(renderers.BaseRenderer):
    """直接把视图返回的字符串原样输出，用于 CSV 下载。"""

    media_type = "text/csv"
    format = "csv"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class PassthroughZipRenderer(renderers.BaseRenderer):
    """原样输出二进制内容，用于 ZIP 训练包下载。"""

    media_type = "application/zip"
    format = "zip"
    charset = None

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


REVIEW_STATUS_LABELS = dict(MonitorRecord.ReviewStatus.choices)
MEDIA_TYPE_LABELS = dict(MonitorRecord.MediaType.choices)


def _csv_response(buffer: io.StringIO, filename: str) -> HttpResponse:
    response = HttpResponse(buffer.getvalue(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


# ── 训练集导出辅助 ─────────────────────────────────────────────

def _build_training_csv(records) -> io.StringIO:
    """生成训练集清单 CSV（复核确认为标签，保留原始 AI 识别结果）。"""
    buffer = io.StringIO()
    buffer.write("\ufeff")
    writer = csv.writer(buffer)
    writer.writerow([
        "样本文件", "媒体类型", "标签物种", "标签拉丁名", "原AI识别物种",
        "原置信度", "复核状态", "设备", "样区", "采集时间", "数据质量标记",
    ])
    for record in records:
        label = record.corrected_species or record.species
        writer.writerow([
            record.media_url,
            MEDIA_TYPE_LABELS.get(record.media_type, record.media_type),
            label.chinese_name if label else "",
            label.latin_name if label else "",
            record.species.chinese_name if record.species else "",
            f"{record.confidence:.4f}",
            REVIEW_STATUS_LABELS.get(record.review_status, record.review_status),
            record.device.name if record.device else "",
            record.survey_area.name if record.survey_area else "",
            record.timestamp.strftime("%Y-%m-%d %H:%M:%S") if record.timestamp else "",
            record.quality_flag,
        ])
    return buffer


def _safe_filename(text: str, fallback: str) -> str:
    """把物种名等文本转成安全的目录/文件名。"""
    cleaned = "".join(ch for ch in (text or "") if ch.isalnum() or ch in ("-", "_"))
    return cleaned or fallback


def _record_label(record):
    """训练标签优先级：人工修正物种 > AI 识别物种。"""
    return record.corrected_species or record.species


def _build_class_map(records) -> dict:
    """按物种 ID 稳定排序，生成 {species_id: {idx, name, latin}}。"""
    species = {}
    for record in records:
        label = _record_label(record)
        if label is not None:
            species.setdefault(label.id, label)
    ordered = sorted(species.values(), key=lambda sp: sp.id)
    return {
        sp.id: {
            "idx": idx,
            "name": _safe_filename(sp.chinese_name, f"species_{sp.id}"),
            "cn": sp.chinese_name,
            "latin": sp.latin_name,
        }
        for idx, sp in enumerate(ordered)
    }


def _record_detections(record):
    """取出与 AI 首候选对应的检测框（坐标为 xyxy 绝对像素）。"""
    tasks = list(record.tasks.all()[:1])
    if not tasks:
        return []
    task = tasks[0]
    top_k = (task.result_payload or {}).get("top_k") or []
    if not top_k:
        return []
    top1 = top_k[0]
    # 仅当人工未修正物种时，检测框与标签才一致
    if record.corrected_species_id and record.corrected_species_id != record.species_id:
        return []
    if top1.get("species_id") and top1.get("species_id") != record.species_id:
        return []
    boxes = top1.get("bboxes") or ([top1["bbox"]] if top1.get("bbox") else [])
    return [box for box in boxes if isinstance(box, (list, tuple)) and len(box) == 4]


def _record_ai_summary(record) -> dict:
    """原始 AI 识别结果摘要，用于错分分析（不含分割掩码等大字段）。"""
    tasks = list(record.tasks.all()[:1])
    task = tasks[0] if tasks else None
    payload = (task.result_payload or {}) if task else {}
    return {
        "record_id": record.id,
        "asset_id": record.asset_id,
        "media_url": record.media_url,
        "media_type": record.media_type,
        "label": _record_label(record).chinese_name if _record_label(record) else "",
        "ai_species": record.species.chinese_name if record.species else "",
        "ai_confidence": record.confidence,
        "review_status": record.review_status,
        "quality_flag": record.quality_flag,
        "audio_reliability": record.audio_reliability,
        "audio_grade": record.audio_grade,
        "device": record.device.name if record.device else "",
        "survey_area": record.survey_area.name if record.survey_area else "",
        "captured_at": record.timestamp.isoformat() if record.timestamp else None,
        "task": {
            "request_id": task.request_id if task else "",
            "status": task.status if task else "",
            "tier": task.tier if task else "",
            "decided_by": task.decided_by if task else "",
            "provider": task.provider if task else "",
            "model_version": task.model_version if task else "",
            "escalated": task.escalated if task else False,
            "escalation_reason": task.escalation_reason if task else "",
            "edge_confidence": task.edge_confidence if task else None,
            "cloud_confidence": task.cloud_confidence if task else None,
            "latency_ms": task.latency_ms if task else None,
        },
        "top_k": payload.get("top_k", []),
        "noise_ratio": payload.get("noise_ratio"),
        "separation_quality": payload.get("separation_quality"),
    }


def _image_size(path: str):
    """读取图片宽高，失败时返回 (None, None)。"""
    try:
        from PIL import Image
        with Image.open(path) as img:
            return img.width, img.height
    except Exception:
        return None, None


# ── 训练包：视频抽帧 / 分割 polygon ──────────────────────────

def _record_segmentation(record) -> list[dict]:
    """取出与记录标签一致的像素级分割结果（仅原图尺寸一致时可用于 polygon）。"""
    task = _first_task(record)
    if task is None:
        return []
    if record.corrected_species_id and record.corrected_species_id != record.species_id:
        return []
    items = (task.segmentation_result or {}).get("segmentations") or []
    return [item for item in items if item.get("species_id") == record.species_id]


def _first_task(record):
    tasks = list(record.tasks.all()[:1])
    return tasks[0] if tasks else None


def _rle_mask(rle: dict):
    """解析 COCO RLE 为二值 mask（行优先 F 序）；解析失败返回 None。"""
    try:
        import numpy as np

        size = rle.get("size") or []
        if len(size) != 2:
            return None
        h, w = int(size[0]), int(size[1])
        counts = rle.get("counts")
        if isinstance(counts, str):
            runs = [int(v) for v in counts.split()]
        elif isinstance(counts, (list, tuple)):
            runs = [int(v) for v in counts]
        else:
            return None
        if not runs:
            return None
        flat = np.zeros(h * w, dtype=np.uint8)
        pos, value = 0, 0
        for run in runs:
            end = min(pos + run, h * w)
            if value:
                flat[pos:end] = 1
            pos, value = end, 1 - value
            if pos >= h * w:
                break
        return flat.reshape((h, w), order="F")
    except Exception:
        return None


def _rle_polygons(rle: dict, width: int, height: int) -> list[list[tuple[float, float]]]:
    """RLE → 原图坐标 polygon；仅在 mask 尺寸与原图一致且 cv2 可用时输出。"""
    size = rle.get("size") or []
    if len(size) != 2 or int(size[0]) != int(height) or int(size[1]) != int(width):
        return []
    try:
        import cv2

        mask = _rle_mask(rle)
        if mask is None:
            return []
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        polygons = []
        for contour in contours:
            if cv2.contourArea(contour) < 1:
                continue
            approx = cv2.approxPolyDP(contour, 0.002 * cv2.arcLength(contour, True), True)
            pts = approx.reshape(-1, 2)
            if len(pts) >= 3:
                polygons.append([(float(x), float(y)) for x, y in pts])
        return polygons
    except Exception:
        return []


def _extract_video_frames(path: str, fps: float) -> tuple[list[str], str]:
    """用 ffmpeg 按指定帧率抽帧，返回 (帧文件列表, 临时目录)；失败返回 ([], "")。"""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return [], ""
    tmp_dir = tempfile.mkdtemp(prefix="biodiv-frames-")
    pattern = os.path.join(tmp_dir, "f%03d.jpg")
    try:
        subprocess.run(
            [ffmpeg, "-loglevel", "error", "-i", path, "-vf", f"fps={fps}", "-q:v", "3", pattern],
            check=True, timeout=180, capture_output=True,
        )
        frames = sorted(
            os.path.join(tmp_dir, name) for name in os.listdir(tmp_dir) if name.endswith(".jpg")
        )
        return frames, tmp_dir
    except Exception:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return [], ""


@extend_schema_view(
    list=extend_schema(summary="监测记录列表"),
    retrieve=extend_schema(summary="监测记录详情"),
)
class MonitorRecordViewSet(viewsets.ReadOnlyModelViewSet):
    """只读查看监测记录，写入需通过设备数据上报接口。"""
    queryset = MonitorRecord.objects.select_related(
        "device", "survey_area", "species", "corrected_species", "reviewed_by", "asset"
    ).all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = {
        "review_status": ["exact"],
        "media_type": ["exact"],
        "quality_flag": ["exact"],
        "device": ["exact"],
        "survey_area": ["exact"],
        "species": ["exact"],
        "corrected_species": ["exact"],
        "confidence": ["gte", "lt"],
        "timestamp": ["gte", "lte"],
    }
    search_fields = ["behavior", "species__chinese_name", "species__latin_name", "device__name"]
    ordering_fields = ["timestamp", "confidence", "created_at"]
    ordering = ["-timestamp"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return MonitorRecordDetailSerializer
        return MonitorRecordListSerializer

    @extend_schema(summary="导出监测记录 CSV(农技人员/管理员)")
    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsAdminOrStaff],
        renderer_classes=[PassthroughRenderer],
    )
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())

        buffer = io.StringIO()
        buffer.write("\ufeff")
        writer = csv.writer(buffer)
        writer.writerow([
            "记录ID", "采集时间", "设备名称", "样区", "物种中文名", "拉丁名",
            "数量", "行为", "置信度", "复核阈值", "复核状态", "修正后物种",
            "复核人", "复核时间", "数据质量标记", "声学可靠度", "声学等级",
            "经度", "纬度", "媒体类型",
        ])
        for record in queryset.iterator():
            writer.writerow([
                record.id,
                record.timestamp.strftime("%Y-%m-%d %H:%M:%S") if record.timestamp else "",
                record.device.name if record.device else "",
                record.survey_area.name if record.survey_area else "",
                record.species.chinese_name if record.species else "",
                record.species.latin_name if record.species else "",
                record.count,
                record.behavior,
                f"{record.confidence:.4f}" if record.confidence is not None else "",
                f"{effective_threshold(record):.2f}",
                REVIEW_STATUS_LABELS.get(record.review_status, record.review_status),
                record.corrected_species.chinese_name if record.corrected_species else "",
                record.reviewed_by.username if record.reviewed_by else "",
                record.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if record.reviewed_at else "",
                record.quality_flag,
                f"{record.audio_reliability:.3f}" if record.audio_reliability is not None else "",
                record.audio_grade,
                record.lng,
                record.lat,
                MEDIA_TYPE_LABELS.get(record.media_type, record.media_type),
            ])

        filename = f"monitor_records_{date.today().strftime('%Y%m%d')}.csv"
        from apps.users.audit import audit_action
        audit_action(request, "export", target_type="monitor_record", detail="导出监测记录 CSV")
        return _csv_response(buffer, filename)

    # ── 复核队列与统计 ──────────────────────────────────────

    @extend_schema(summary="复核队列(按风险优先级排序)")
    @action(detail=False, methods=["get"], permission_classes=[IsAdminOrStaff])
    def review_queue(self, request):
        queryset = self.filter_queryset(self.get_queryset()).filter(
            review_status=MonitorRecord.ReviewStatus.PENDING
        )
        # 队列上限保护，避免一次加载过多
        records = list(queryset[:1000])
        scored = []
        for record in records:
            threshold = effective_threshold(record)
            # 入队规则：置信度低于记录级阈值，或存在硬质量标记（声学降级仅抬高阈值）
            if not needs_review(record, threshold):
                continue
            scored.append((
                risk_priority(record, threshold),
                record.confidence,           # 同优先级内置信度低的先复核
                record.timestamp,
                record,
            ))
        scored.sort(key=lambda x: (x[0], x[1], -x[2].timestamp()))

        page = max(int(request.query_params.get("page", 1)), 1)
        page_size = min(int(request.query_params.get("pageSize", 20)), 200)
        start = (page - 1) * page_size
        page_records = [item[3] for item in scored[start:start + page_size]]

        return Response({
            "code": 0,
            "message": "ok",
            "data": {
                "list": MonitorRecordListSerializer(page_records, many=True).data,
                "total": len(scored),
                "page": page,
                "pageSize": page_size,
                "priorityBreakdown": {
                    "protected": sum(1 for item in scored if item[0] in (0, 2)),
                    "invasive": sum(1 for item in scored if item[0] == 1),
                    "common": sum(1 for item in scored if item[0] in (3, 4)),
                },
            },
        })

    @extend_schema(summary="复核统计")
    @action(detail=False, methods=["get"], permission_classes=[IsAdminOrStaff])
    def review_stats(self, request):
        base = self.filter_queryset(self.get_queryset())
        today = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)

        pending = list(
            base.filter(review_status=MonitorRecord.ReviewStatus.PENDING)
            .select_related("species")[:2000]
        )
        # 与复核队列保持同一入队规则，避免统计数与队列数不一致
        eligible = [r for r in pending if needs_review(r)]
        pending_total = len(eligible)
        pending_protected = sum(
            1 for r in eligible
            if r.species and r.species.severity in HIGH_RISK_LEVELS
        )
        pending_low_conf = sum(1 for r in eligible if (r.confidence or 0) < 0.6)

        reviewed_today = base.filter(reviewed_at__gte=today).count()
        confirmed = base.filter(review_status=MonitorRecord.ReviewStatus.CONFIRMED).count()
        corrected = base.filter(review_status=MonitorRecord.ReviewStatus.CORRECTED).count()
        rejected = base.filter(review_status=MonitorRecord.ReviewStatus.REJECTED).count()
        reviewed_total = confirmed + corrected + rejected

        return Response({
            "code": 0,
            "message": "ok",
            "data": {
                "pendingTotal": pending_total,
                "pendingProtected": pending_protected,
                "pendingLowConfidence": pending_low_conf,
                "reviewedToday": reviewed_today,
                "confirmed": confirmed,
                "corrected": corrected,
                "rejected": rejected,
                "reviewedTotal": reviewed_total,
                "accuracyRate": round(confirmed / reviewed_total, 4) if reviewed_total else 0,
                "correctionRate": round(corrected / reviewed_total, 4) if reviewed_total else 0,
            },
        })

    # ── 复核操作 ────────────────────────────────────────────

    def _apply_review(self, record, status_value, corrected_species, remark, user):
        record.review_status = status_value
        record.corrected_species = corrected_species
        record.reviewed_by = user
        record.reviewed_at = timezone.now()
        if remark is not None:
            record.remark = remark
        record.save(update_fields=[
            "review_status", "corrected_species", "reviewed_by", "reviewed_at", "remark",
        ])

    @extend_schema(summary="复核记录(确认/修正/否定)")
    @action(detail=True, methods=["post"], permission_classes=[IsAdminOrStaff])
    def review(self, request, pk=None):
        record = self.get_object()
        status_value = request.data.get("status")
        if status_value not in dict(MonitorRecord.ReviewStatus.choices):
            return Response({"code": 40001, "message": "无效的复核状态"}, status=status.HTTP_400_BAD_REQUEST)

        corrected_species = None
        if status_value == MonitorRecord.ReviewStatus.CORRECTED:
            species_id = request.data.get("corrected_species")
            if not species_id:
                return Response(
                    {"code": 40001, "message": "修正物种时必须指定正确的物种"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            corrected_species = Species.objects.filter(pk=species_id).first()
            if corrected_species is None:
                return Response({"code": 40001, "message": "修正物种不存在"}, status=status.HTTP_400_BAD_REQUEST)
            if record.species_id == corrected_species.id:
                return Response(
                    {"code": 40001, "message": "修正物种与 AI 识别结果相同，请使用「确认」"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        self._apply_review(
            record, status_value, corrected_species,
            request.data.get("remark"), request.user,
        )
        from apps.users.audit import audit_action
        species_label = (record.corrected_species or record.species).chinese_name if (record.corrected_species or record.species) else ""
        status_label = REVIEW_STATUS_LABELS.get(status_value, status_value)
        audit_action(
            request, "review",
            target_type="monitor_record", target_id=record.id,
            target_label=f"记录#{record.id} {species_label}",
            detail=f"复核：{status_label}（AI：{record.species.chinese_name if record.species else ''}，置信 {(record.confidence or 0)*100:.1f}%）",
        )
        # 确认/修正后同步登记训练样本，否定则清理旧样本
        from .tasks import enqueue_training_sample
        enqueue_training_sample(record.id)
        # 复核结论接入证据融合：即时重建所在时间窗
        from apps.fusion.services import rebuild_for_record
        rebuild_for_record(record)
        return Response({
            "code": 0,
            "message": "ok",
            "data": MonitorRecordListSerializer(record).data,
        })

    @extend_schema(summary="批量复核(确认/否定)")
    @action(detail=False, methods=["post"], permission_classes=[IsAdminOrStaff])
    def batch_review(self, request):
        ids = request.data.get("ids") or []
        status_value = request.data.get("status")
        if not isinstance(ids, list) or not ids:
            return Response({"code": 40001, "message": "请至少选择一条记录"}, status=status.HTTP_400_BAD_REQUEST)
        if status_value not in (
            MonitorRecord.ReviewStatus.CONFIRMED,
            MonitorRecord.ReviewStatus.REJECTED,
        ):
            return Response(
                {"code": 40001, "message": "批量复核仅支持确认或否定"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        records = MonitorRecord.objects.filter(pk__in=ids)
        timestamps = list(records.values_list("timestamp", flat=True))
        now = timezone.now()
        updated = records.update(
            review_status=status_value,
            reviewed_by=request.user,
            reviewed_at=now,
        )
        from apps.users.audit import audit_action
        audit_action(
            request, "review",
            target_type="monitor_record",
            detail=f"批量复核 {updated} 条记录：{REVIEW_STATUS_LABELS.get(status_value, status_value)}",
        )
        from .tasks import enqueue_training_sample
        for record_id in ids:
            enqueue_training_sample(int(record_id))
        # 复核结论接入证据融合：按涉及时间窗去重即时重建
        from apps.fusion.services import rebuild_for_records
        rebuild_for_records(timestamps)
        return Response({"code": 0, "message": "ok", "data": {"updated": updated}})

    # ── 训练样本池 ──────────────────────────────────────────

    def _training_sample_queryset(self, request):
        from django.db.models import Q

        queryset = TrainingSample.objects.select_related(
            "record", "record__device", "record__survey_area", "label", "asset",
        ).defer("audio_meta", "video_meta", "segmentation")
        media_type = request.query_params.get("media_type")
        if media_type in dict(TrainingSample.MediaType.choices):
            queryset = queryset.filter(media_type=media_type)
        label_source = request.query_params.get("label_source")
        if label_source in dict(TrainingSample.LabelSource.choices):
            queryset = queryset.filter(label_source=label_source)
        status_value = request.query_params.get("status")
        if status_value in dict(TrainingSample.Status.choices):
            queryset = queryset.filter(status=status_value)
        label_id = request.query_params.get("label")
        if label_id:
            queryset = queryset.filter(label_id=label_id)
        keyword = request.query_params.get("keyword")
        if keyword:
            queryset = queryset.filter(
                Q(label__chinese_name__icontains=keyword)
                | Q(label__latin_name__icontains=keyword)
                | Q(record__device__name__icontains=keyword)
                | Q(record__survey_area__name__icontains=keyword)
            )
        return queryset

    @extend_schema(summary="训练样本列表")
    @action(detail=False, methods=["get"], permission_classes=[IsAdminOrStaff])
    def training_samples(self, request):
        queryset = self._training_sample_queryset(request).order_by("-created_at")
        page = max(int(request.query_params.get("page", 1)), 1)
        page_size = min(int(request.query_params.get("pageSize", 20)), 200)
        total = queryset.count()
        start = (page - 1) * page_size
        items = queryset[start:start + page_size]
        return Response({
            "code": 0,
            "message": "ok",
            "data": {
                "list": TrainingSampleSerializer(items, many=True).data,
                "total": total,
                "page": page,
                "pageSize": page_size,
            },
        })

    @extend_schema(summary="训练样本池统计")
    @action(detail=False, methods=["get"], permission_classes=[IsAdminOrStaff])
    def training_stats(self, request):
        from django.db.models import Count, Max

        queryset = TrainingSample.objects.all()
        total = queryset.count()
        ready = queryset.filter(status=TrainingSample.Status.READY).count()
        exported = queryset.filter(status=TrainingSample.Status.EXPORTED).count()
        by_media = {
            row["media_type"]: row["count"]
            for row in queryset.values("media_type").annotate(count=Count("id"))
        }
        by_source = {
            row["label_source"]: row["count"]
            for row in queryset.values("label_source").annotate(count=Count("id"))
        }
        auto_confirmed = MonitorRecord.objects.filter(
            review_status=MonitorRecord.ReviewStatus.CONFIRMED,
            reviewed_by__isnull=True,
        ).count()
        last_exported_at = queryset.aggregate(value=Max("exported_at"))["value"]
        return Response({
            "code": 0,
            "message": "ok",
            "data": {
                "total": total,
                "ready": ready,
                "exported": exported,
                "exportRate": round(exported / total, 4) if total else 0,
                "byMediaType": {
                    "image": by_media.get(TrainingSample.MediaType.IMAGE, 0),
                    "video": by_media.get(TrainingSample.MediaType.VIDEO, 0),
                    "audio": by_media.get(TrainingSample.MediaType.AUDIO, 0),
                },
                "byLabelSource": {
                    "auto": by_source.get(TrainingSample.LabelSource.AUTO, 0),
                    "review": by_source.get(TrainingSample.LabelSource.REVIEW, 0),
                    "ai": by_source.get(TrainingSample.LabelSource.AI, 0),
                },
                "autoConfirmedTotal": auto_confirmed,
                "lastExportedAt": last_exported_at,
                "autoConfirmEnabled": config_bool("auto_confirm_enabled", True),
                "autoConfirmThreshold": config_float("auto_confirm_threshold", 0.9),
                "audioEnabled": config_bool("training_audio_enabled", True),
                "videoEnabled": config_bool("training_video_enabled", True),
            },
        })

    @extend_schema(summary="导出训练样本清单 CSV")
    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsAdminOrStaff],
        renderer_classes=[PassthroughRenderer],
    )
    def training_samples_csv(self, request):
        queryset = self._training_sample_queryset(request).order_by("-created_at")
        buffer = io.StringIO()
        buffer.write("\ufeff")
        writer = csv.writer(buffer)
        writer.writerow([
            "样本ID", "记录ID", "媒体类型", "标签物种", "标签拉丁名", "标签来源",
            "置信度", "质量标记", "设备", "样区", "采集时间", "状态", "导出时间",
        ])
        for sample in queryset.iterator():
            label = sample.label
            writer.writerow([
                sample.id,
                sample.record_id,
                MEDIA_TYPE_LABELS.get(sample.media_type, sample.media_type),
                label.chinese_name if label else "",
                label.latin_name if label else "",
                sample.label_source,
                f"{sample.confidence:.4f}",
                sample.quality_flag,
                sample.record.device.name if sample.record.device else "",
                sample.record.survey_area.name if sample.record.survey_area else "",
                sample.record.timestamp.strftime("%Y-%m-%d %H:%M:%S") if sample.record.timestamp else "",
                sample.status,
                sample.exported_at.strftime("%Y-%m-%d %H:%M:%S") if sample.exported_at else "",
            ])
        filename = f"training_samples_{date.today().strftime('%Y%m%d')}.csv"
        from apps.users.audit import audit_action
        audit_action(request, "export", target_type="training_sample", detail="导出训练样本清单 CSV")
        return _csv_response(buffer, filename)

    # ── 闭环：训练集导出 ────────────────────────────────────

    @extend_schema(summary="导出已复核数据为训练集(农技人员/管理员)")
    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsAdminOrStaff],
        renderer_classes=[PassthroughRenderer],
    )
    def export_training(self, request):
        queryset = self.filter_queryset(self.get_queryset()).filter(
            review_status__in=[
                MonitorRecord.ReviewStatus.CONFIRMED,
                MonitorRecord.ReviewStatus.CORRECTED,
            ]
        ).select_related("species", "corrected_species", "device", "survey_area")

        buffer = _build_training_csv(queryset)

        filename = f"training_set_{date.today().strftime('%Y%m%d')}.csv"
        from apps.users.audit import audit_action
        audit_action(request, "export", target_type="training_set", detail="导出已复核数据为训练集 CSV")
        return _csv_response(buffer, filename)

    @extend_schema(summary="导出训练包 ZIP(原始文件 + YOLO/COCO 标签 + AI 识别结果)")
    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsAdminOrStaff],
        renderer_classes=[PassthroughZipRenderer],
    )
    def export_package(self, request):
        """打包已复核样本：原始文件、检测/分类标签、manifest 与 AI 原始结果。

        查询参数:
          - fmt: yolo（默认）| coco（不能用 format，会与 DRF 渲染器覆盖参数冲突）
          - include_ai: 是否附带 ai_results.jsonl（默认 true）
        """
        export_format = request.query_params.get("fmt", "yolo").lower()
        if export_format not in ("yolo", "coco"):
            export_format = "yolo"
        include_ai = request.query_params.get("include_ai", "true").lower() != "false"

        queryset = self.filter_queryset(self.get_queryset()).filter(
            review_status__in=[
                MonitorRecord.ReviewStatus.CONFIRMED,
                MonitorRecord.ReviewStatus.CORRECTED,
            ]
        ).select_related(
            "species", "corrected_species", "device", "survey_area", "asset",
        ).prefetch_related("tasks")

        records = list(queryset)
        class_map = _build_class_map(records)

        coco = {"images": [], "annotations": [], "categories": []} if export_format == "coco" else None
        coco_image_id = 1
        coco_ann_id = 1
        manifest = []
        ai_results = []
        audio_rows = []
        video_frames = []
        video_fps = max(config_float("video_frame_fps", 1.0), 0.1)

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("labels.csv", _build_training_csv(records).getvalue())

            for record in records:
                label = _record_label(record)
                asset = record.asset
                entry = {
                    "record_id": record.id,
                    "asset_id": record.asset_id,
                    "media_type": record.media_type,
                    "label": label.chinese_name if label else "",
                    "label_latin": label.latin_name if label else "",
                    "ai_species": record.species.chinese_name if record.species else "",
                    "ai_confidence": record.confidence,
                    "review_status": record.review_status,
                    "quality_flag": record.quality_flag,
                    "device": record.device.name if record.device else "",
                    "survey_area": record.survey_area.name if record.survey_area else "",
                    "captured_at": record.timestamp.isoformat() if record.timestamp else None,
                }
                if include_ai:
                    ai_results.append(_record_ai_summary(record))

                if not asset or not asset.file:
                    entry["file"] = ""
                    entry["note"] = "原始资产缺失，未打包文件"
                    manifest.append(entry)
                    continue

                name = asset.file.name
                ext = os.path.splitext(name)[1].lower()
                stem = f"r{record.id}"
                is_image = record.media_type == MonitorRecord.MediaType.IMAGE
                entry["file"] = ""

                try:
                    with local_copy(name) as path:
                        # ── 音频：原文件 + PANNs 标签清单 ──
                        if record.media_type == MonitorRecord.MediaType.AUDIO \
                                and config_bool("training_audio_enabled", True):
                            arc = f"audio/{stem}{ext}"
                            zf.write(path, arc)
                            entry["file"] = arc
                            entry["note"] = "音频样本，可直接用于 PANNs 分类训练"
                            audio_rows.append({
                                "file": arc,
                                "label": label.chinese_name if label else "",
                                "label_latin": label.latin_name if label else "",
                                "start_sec": 0,
                                "end_sec": round(asset.duration or 0, 3),
                                "duration": round(asset.duration or 0, 3),
                                "confidence": round(record.confidence or 0, 4),
                                "quality_flag": record.quality_flag,
                                "reliability_score": asset.reliability_score,
                                "grade": asset.reliability_grade,
                                "device": entry["device"],
                                "survey_area": entry["survey_area"],
                            })
                            manifest.append(entry)
                            continue

                        # ── 视频：按配置帧率抽帧，帧图像进入 images/ ──
                        if record.media_type == MonitorRecord.MediaType.VIDEO \
                                and config_bool("training_video_enabled", True):
                            frames, frame_dir = _extract_video_frames(path, video_fps)
                            if frames:
                                try:
                                    for idx, frame in enumerate(frames):
                                        arc = f"images/{stem}_f{idx:03d}.jpg"
                                        zf.write(frame, arc)
                                        video_frames.append({
                                            "record_id": record.id,
                                            "file": arc,
                                            "frame_index": idx,
                                            "time_sec": round(idx / video_fps, 3),
                                            "label": entry["label"],
                                            "device": entry["device"],
                                            "survey_area": entry["survey_area"],
                                        })
                                finally:
                                    shutil.rmtree(frame_dir, ignore_errors=True)
                                entry["file"] = f"images/{stem}_f000.jpg"
                                entry["frame_count"] = len(frames)
                                entry["frame_fps"] = video_fps
                                entry["note"] = "视频已按帧率抽帧，帧图像用于检测训练"
                                manifest.append(entry)
                                continue

                        if not is_image:
                            arc = f"raw/{asset.source_type}/{stem}{ext}"
                            zf.write(path, arc)
                            entry["file"] = arc
                            entry["note"] = "非图像样本，放入 raw/ 目录（抽帧不可用或模态未启用）"
                            manifest.append(entry)
                            continue

                        arc = f"images/{stem}{ext}"
                        zf.write(path, arc)
                        entry["file"] = arc

                        width, height = asset.width, asset.height
                        if not width or not height:
                            width, height = _image_size(path)
                        entry["width"], entry["height"] = width, height

                        boxes = _record_detections(record)
                        entry["box_count"] = len(boxes)

                        # 分割结果：JSON 全量留存；尺寸一致时额外生成 polygon
                        seg_items = _record_segmentation(record)
                        polygons = []
                        if seg_items:
                            seg_task = _first_task(record)
                            zf.writestr(
                                f"seg/{stem}.json",
                                json.dumps({
                                    "record_id": record.id,
                                    "label": entry["label"],
                                    "model_version": (seg_task.segmentation_result or {}).get("model_version", "")
                                    if seg_task else "",
                                    "items": seg_items,
                                }, ensure_ascii=False),
                            )
                            entry["segmentation_count"] = len(seg_items)
                            if width and height:
                                for item in seg_items:
                                    polygons.extend(
                                        _rle_polygons(item.get("mask_rle") or {}, width, height)
                                    )

                        if export_format == "coco" and width and height:
                            coco["images"].append({
                                "id": coco_image_id,
                                "file_name": arc,
                                "width": width,
                                "height": height,
                            })
                            category_id = class_map[label.id]["idx"] + 1 if label and label.id in class_map else 0
                            for box in boxes:
                                x1, y1, x2, y2 = [float(v) for v in box]
                                w, h = max(x2 - x1, 0), max(y2 - y1, 0)
                                coco["annotations"].append({
                                    "id": coco_ann_id,
                                    "image_id": coco_image_id,
                                    "category_id": category_id,
                                    "bbox": [round(x1, 2), round(y1, 2), round(w, 2), round(h, 2)],
                                    "area": round(w * h, 2),
                                    "segmentation": [
                                        [round(x / width, 6), round(y / height, 6)] for x, y in poly
                                    ] if polygons else [],
                                    "iscrowd": 0,
                                })
                                coco_ann_id += 1
                            coco_image_id += 1
                        elif export_format == "yolo":
                            lines = []
                            if label and label.id in class_map and width and height:
                                cls_idx = class_map[label.id]["idx"]
                                if polygons:
                                    # YOLO 分割标签：class 后接归一化 polygon 顶点
                                    for poly in polygons:
                                        coords = " ".join(
                                            f"{x / width:.6f} {y / height:.6f}" for x, y in poly
                                        )
                                        lines.append(f"{cls_idx} {coords}")
                                else:
                                    for box in boxes:
                                        x1, y1, x2, y2 = [float(v) for v in box]
                                        cx = ((x1 + x2) / 2) / width
                                        cy = ((y1 + y2) / 2) / height
                                        bw = (x2 - x1) / width
                                        bh = (y2 - y1) / height
                                        lines.append(
                                            f"{cls_idx} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}"
                                        )
                            zf.writestr(f"labels/{stem}.txt", "\n".join(lines))
                            if not lines:
                                entry["note"] = "无检测框/分割结果，标签文件为空（仅可用于分类训练）"
                            elif polygons:
                                entry["note"] = "已输出分割 polygon 标签（YOLO-seg 格式）"
                except Exception as exc:  # 单个文件失败不影响整体导出
                    entry["note"] = f"文件读取失败: {exc}"
                manifest.append(entry)

            zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
            if include_ai:
                lines = "\n".join(json.dumps(item, ensure_ascii=False) for item in ai_results)
                zf.writestr("ai_results.jsonl", lines)

            if audio_rows:
                audio_buffer = io.StringIO()
                audio_buffer.write("\ufeff")
                audio_writer = csv.DictWriter(audio_buffer, fieldnames=list(audio_rows[0].keys()))
                audio_writer.writeheader()
                audio_writer.writerows(audio_rows)
                zf.writestr("panns_labels.csv", audio_buffer.getvalue())
            if video_frames:
                zf.writestr(
                    "video_frames.json",
                    json.dumps(video_frames, ensure_ascii=False, indent=2),
                )

            if export_format == "coco":
                coco["categories"] = [
                    {"id": meta["idx"] + 1, "name": meta["cn"], "latin": meta["latin"]}
                    for meta in class_map.values()
                ]
                zf.writestr("annotations/instances.json",
                            json.dumps(coco, ensure_ascii=False, indent=2))
            else:
                names = "\n".join(f"  {meta['idx']}: {meta['cn']}" for meta in class_map.values())
                zf.writestr(
                    "data.yaml",
                    f"path: .\ntrain: images\nval: images\nnc: {len(class_map)}\nnames:\n{names}\n",
                )
            zf.writestr("README.txt", (
                "生物多样性监测平台训练包\n"
                "contains:\n"
                "  images/      原始图像样本（视频按帧率抽帧后的帧图像也在此）\n"
                "  labels/      YOLO 检测/分割标签（空文件表示无标注）\n"
                "  seg/         像素级分割原始结果（COCO RLE，尺寸一致时可转 polygon）\n"
                "  audio/       音频原文件（PANNs 分类训练）\n"
                "  panns_labels.csv 音频样本标签与质量元数据\n"
                "  video_frames.json 视频抽帧清单（文件、帧序号、时间点）\n"
                "  annotations/ COCO instances.json（fmt=coco 时生成）\n"
                "  manifest.json 每条样本的元数据与文件映射\n"
                "  ai_results.jsonl AI 原始识别结果，用于错分分析\n"
                "  labels.csv   训练集清单\n"
            ))

        # 导出成功后标记样本池状态，便于统计就绪度
        record_ids = [record.id for record in records]
        if record_ids:
            TrainingSample.objects.filter(record_id__in=record_ids).update(
                status=TrainingSample.Status.EXPORTED,
                exported_at=timezone.now(),
            )

        filename = f"training_package_{export_format}_{date.today().strftime('%Y%m%d')}.zip"
        from apps.users.audit import audit_action
        audit_action(
            request, "export", target_type="training_set",
            detail=f"导出训练包 ZIP({export_format})，{len(records)} 条样本",
        )
        response = HttpResponse(buffer.getvalue(), content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
