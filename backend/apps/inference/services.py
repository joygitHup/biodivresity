"""识别任务编排服务：资产入库、去重、模型路由、任务执行与落库。"""
from __future__ import annotations

import hashlib
import logging
import uuid
from dataclasses import asdict, replace
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Avg, Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.models_app.models import ModelVersion
from apps.records.models import MonitorRecord
from apps.records.services import should_auto_confirm
from apps.species.models import Species
from common.config import get_config

from common.storage_utils import local_copy

from .audio_quality import (
    FLAG_AUDIO_DEGRADED,
    GRADE_DEGRADED,
    GRADE_UNRELIABLE,
    analyze_audio_file,
    merge_provider_metrics,
)
from .separation import resolve_separation
from .models import MediaAsset, PredictionTask
from .providers import get_edge_provider, get_provider
from .providers.base import PredictionItem, PredictResult, ProviderError

logger = logging.getLogger(__name__)

RETRY_BACKOFF_SECONDS = [10, 30, 90]
STUCK_TASK_MINUTES = 15
UNSUPPORTED_SOURCES = {MediaAsset.SourceType.EDNA}
HIGH_RISK_LEVELS = {"high", "critical"}


# ── 两级调度配置 ─────────────────────────────────────────────


def _cfg_raw(key: str) -> str:
    return get_config(key)


def _cfg_float(key: str, fallback: float = 0.0) -> float:
    try:
        return float(_cfg_raw(key))
    except (TypeError, ValueError):
        return fallback


def _cfg_int(key: str, fallback: int = 0) -> int:
    try:
        return int(float(_cfg_raw(key)))
    except (TypeError, ValueError):
        return fallback


def _cfg_bool(key: str, fallback: bool = False) -> bool:
    value = _cfg_raw(key)
    if value == "":
        return fallback
    return str(value).strip().lower() in ("true", "1", "yes", "on")


def edge_settings() -> dict:
    """运行时读取调度策略，修改配置后无需重启即可生效。"""
    exceptions_raw = _cfg_raw("edge_protected_exceptions")
    exceptions = set()
    if exceptions_raw:
        for part in str(exceptions_raw).split(","):
            part = part.strip()
            if part.isdigit():
                exceptions.add(int(part))
    return {
        "enabled": _cfg_bool("edge_enabled", True),
        "scope": _cfg_raw("edge_scope") or "device",
        "accept_threshold": _cfg_float("edge_accept_threshold", 0.85),
        "ambiguous_margin": _cfg_float("edge_ambiguous_margin", 0.1),
        "protected_escalate": _cfg_bool("edge_protected_escalate", True),
        "protected_exceptions": exceptions,
        "quality_escalate": _cfg_bool("edge_quality_escalate", True),
        "fallback_to_cloud": _cfg_bool("edge_fallback_to_cloud", True),
        "cloud_daily_budget": _cfg_int("edge_cloud_daily_budget", 0),
        "budget_accept_floor": _cfg_float("edge_budget_accept_floor", 0.6),
        "provider_type": _cfg_raw("edge_provider_type") or "mock",
        "model_version": _cfg_raw("edge_model_version") or "edge-v0.4.0",
    }


def edge_candidate(device, settings: dict | None = None) -> bool:
    """判断该设备的数据是否走「边缘先行」。scope=all 时不要求设备具备边缘能力。"""
    cfg = settings or edge_settings()
    if not cfg["enabled"]:
        return False
    if cfg["scope"] == "all":
        return True
    return bool(device and getattr(device, "edge_enabled", False))


def cloud_budget_used(exclude_task_id: int | None = None) -> int:
    qs = PredictionTask.objects.filter(
        started_at__date=timezone.now().date(), tier=PredictionTask.Tier.CLOUD,
    )
    if exclude_task_id:
        qs = qs.exclude(pk=exclude_task_id)
    return qs.count()


def _is_high_risk(item) -> bool:
    if item is None:
        return False
    if item.severity and item.severity != "none":
        return item.severity in HIGH_RISK_LEVELS
    if item.species_id:
        level = Species.objects.filter(pk=item.species_id).values_list(
            "severity", flat=True,
        ).first()
        return bool(level and level in HIGH_RISK_LEVELS)
    return False


def decide_edge(result: PredictResult, settings: dict) -> tuple[bool, str]:
    """增强版判定策略：高风险病虫害/歧义/质量异常一律上云，其余按阈值直判。

    高风险例外：在 edge_protected_exceptions 中的类别不强制上云，按普通阈值判定。
    """
    top1 = result.top1
    if top1 is None:
        return False, PredictionTask.EscalationReason.LOW_CONFIDENCE
    exceptions = settings.get("protected_exceptions") or set()
    if settings["protected_escalate"] and _is_high_risk(top1):
        if top1.species_id not in exceptions:
            return False, PredictionTask.EscalationReason.HIGH_RISK
    if len(result.top_k) > 1:
        gap = top1.confidence - result.top_k[1].confidence
        if gap < settings["ambiguous_margin"]:
            return False, PredictionTask.EscalationReason.AMBIGUOUS
    if settings["quality_escalate"] and result.quality_flag:
        return False, PredictionTask.EscalationReason.LOW_QUALITY
    if top1.confidence >= settings["accept_threshold"]:
        return True, ""
    return False, PredictionTask.EscalationReason.LOW_CONFIDENCE


# ── 资产入库 ─────────────────────────────────────────────────


def compute_sha256(django_file) -> str:
    """流式计算文件哈希，避免大文件全量读入内存。"""
    digest = hashlib.sha256()
    for chunk in django_file.chunks():
        digest.update(chunk)
    try:
        django_file.seek(0)
    except Exception:
        pass
    return digest.hexdigest()


def _probe_image_size(django_file):
    try:
        from PIL import Image
        img = Image.open(django_file)
        size = img.size
        django_file.seek(0)
        return size
    except Exception:  # 非图片或损坏文件不阻断入库
        try:
            django_file.seek(0)
        except Exception:
            pass
        return None, None


def create_asset_from_upload(
    job,
    *,
    source_type: str,
    device=None,
    survey_area=None,
    captured_at=None,
    quality_score=None,
    burst_group: str = "",
    exif: dict | None = None,
    uploader=None,
) -> tuple[MediaAsset, PredictionTask | None, str]:
    """落盘一个文件并创建识别任务。

    返回 (asset, task, reason)。reason 为空表示正常入队；
    duplicate / unsupported / rejected 表示未创建任务。
    """
    asset = MediaAsset(
        file=job,
        source_type=source_type,
        mime_type=getattr(job, "content_type", "") or "",
        size=job.size,
        sha256="",
        quality_score=quality_score,
        burst_group=burst_group,
        exif=exif or {},
        captured_at=captured_at,
        device=device,
        survey_area=survey_area or (device.survey_area if device else None),
        uploaded_by=uploader,
    )
    asset.sha256 = compute_sha256(job)
    if source_type == MediaAsset.SourceType.IMAGE:
        asset.width, asset.height = _probe_image_size(job)

    # 去重：同哈希的资产不再重复送识别
    if MediaAsset.objects.filter(sha256=asset.sha256).exists():
        asset.quality_status = MediaAsset.QualityStatus.DUPLICATE
        asset.is_rejected = True
        asset.save()
        task = PredictionTask.objects.create(
            request_id=f"req_{uuid.uuid4().hex[:16]}",
            asset=asset,
            task_type=PredictionTask.TaskType.IMAGE,
            status=PredictionTask.Status.SKIPPED,
            error_code="duplicate",
            error_message="重复文件，已跳过识别",
        )
        return asset, task, "duplicate"

    asset.save()

    if source_type in UNSUPPORTED_SOURCES:
        task = PredictionTask.objects.create(
            request_id=f"req_{uuid.uuid4().hex[:16]}",
            asset=asset,
            task_type=PredictionTask.TaskType.IMAGE,
            status=PredictionTask.Status.SKIPPED,
            error_code="unsupported_source",
            error_message="eDNA 数据需走专用分析流程，暂不进入图像/声学识别队列",
        )
        return asset, task, "unsupported"

    task_type = (
        PredictionTask.TaskType.AUDIO
        if source_type == MediaAsset.SourceType.AUDIO
        else PredictionTask.TaskType.IMAGE
    )
    initial_tier = (
        PredictionTask.Tier.EDGE if edge_candidate(device) else PredictionTask.Tier.CLOUD
    )
    model, is_gray = route_model(model_task_type(task_type), device, tier=initial_tier)
    task = PredictionTask.objects.create(
        request_id=f"req_{uuid.uuid4().hex[:16]}",
        asset=asset,
        task_type=task_type,
        model=model,
        model_version=model.version if model else "",
        is_gray=is_gray,
        tier=initial_tier,
    )
    return asset, task, ""


def model_task_type(task_type: str) -> str:
    return ModelVersion.TaskType.AUDIO if task_type == PredictionTask.TaskType.AUDIO \
        else ModelVersion.TaskType.IMAGE


# ── 模型路由（灰度） ─────────────────────────────────────────


def route_model(task_type: str, device=None, tier: str | None = None):
    """为任务选择模型版本：按层级筛选，灰度版本按设备哈希分流，其余走线上版本。"""
    candidates = ModelVersion.objects.filter(
        task_type=task_type,
        status__in=[ModelVersion.Status.ACTIVE, ModelVersion.Status.TESTING],
    )
    if tier:
        candidates = candidates.filter(tier=tier)

    bucket = None
    if device is not None:
        bucket = int(hashlib.sha256(str(device.id).encode()).hexdigest()[:8], 16) % 100

    for model in candidates.filter(traffic_ratio__gt=0).order_by("-created_at"):
        if bucket is not None and bucket < model.traffic_ratio:
            return model, True

    active = candidates.filter(is_active=True).order_by("-created_at").first()
    if active:
        return active, False
    fallback = candidates.order_by("-created_at").first()
    return fallback, False


# ── 任务执行 ─────────────────────────────────────────────────


def _next_backoff(attempts: int) -> int:
    idx = min(max(attempts - 1, 0), len(RETRY_BACKOFF_SECONDS) - 1)
    return RETRY_BACKOFF_SECONDS[idx]


def _serialize_result(result: PredictResult, audio_quality: dict | None = None) -> dict:
    payload = {
        "top_k": [asdict(item) for item in result.top_k],
        "model_version": result.model_version,
        "provider": result.provider,
        "latency_ms": result.latency_ms,
        "quality_flag": result.quality_flag,
        "noise_ratio": result.noise_ratio,
        "separation_quality": result.separation_quality,
        "segments": result.segments,
        "raw": result.raw,
    }
    if audio_quality:
        payload["audio_quality"] = audio_quality
    return payload


def _create_record(task: PredictionTask, asset: MediaAsset, result: PredictResult,
                   audio_quality: dict | None = None,
                   decided_by: str = PredictionTask.DecidedBy.CLOUD) -> MonitorRecord | None:
    top1 = result.top1
    if top1 is None:
        return None

    species = Species.objects.filter(pk=top1.species_id).first() if top1.species_id else None
    if species is None and top1.chinese_name:
        # 类别映射未写死主键时，按名称回查档案
        species = Species.objects.filter(chinese_name=top1.chinese_name).first()

    media_type = {
        MediaAsset.SourceType.AUDIO: MonitorRecord.MediaType.AUDIO,
        MediaAsset.SourceType.VIDEO: MonitorRecord.MediaType.VIDEO,
    }.get(asset.source_type, MonitorRecord.MediaType.IMAGE)
    stage_label = "边缘直判" if decided_by == PredictionTask.DecidedBy.EDGE else "云端识别"

    return MonitorRecord.objects.create(
        asset=asset,
        device=asset.device,
        survey_area=asset.survey_area,
        species=species,
        timestamp=asset.captured_at or timezone.now(),
        count=max(top1.count, 1),
        confidence=top1.confidence,
        quality_flag=result.quality_flag,
        audio_reliability=(audio_quality or {}).get("reliability_score"),
        audio_grade=(audio_quality or {}).get("grade", ""),
        media_url=asset.file.url if asset.file else "",
        media_type=media_type,
        remark=f"{stage_label} {task.request_id}（{task.model_version or '未知模型'}）",
    )


def _apply_audio_quality(asset: MediaAsset,
                         result: PredictResult) -> tuple[dict | None, PredictResult]:
    """对音频资产做质量评估，并把结果合并到识别结果与资产记录。"""
    if asset.source_type != MediaAsset.SourceType.AUDIO or not asset.file:
        return None, result

    with local_copy(asset.file.name) as audio_path:
        separation_quality, noise_ratio = resolve_separation(
            audio_path, result.separation_quality, result.noise_ratio,
        )
        metrics = analyze_audio_file(
            audio_path,
            separation_quality=separation_quality,
        )
    metrics = merge_provider_metrics(metrics, separation_quality, noise_ratio)
    if not metrics.get("available"):
        logger.warning("音频质量评估失败 asset=%s: %s", asset.id, metrics.get("reason"))
        return None, result

    asset.snr_db = metrics["snr_db"]
    asset.vad_ratio = metrics["vad_ratio"]
    asset.overlap_ratio = metrics["overlap_ratio"]
    asset.separation_quality = metrics["separation_quality"]
    asset.noise_ratio = metrics.get("noise_ratio")
    asset.reliability_score = metrics["reliability_score"]
    asset.reliability_grade = metrics["grade"]
    asset.duration = metrics["duration"]
    asset.save(update_fields=[
        "snr_db", "vad_ratio", "overlap_ratio", "separation_quality", "noise_ratio",
        "reliability_score", "reliability_grade", "duration",
    ])

    flag = result.quality_flag
    if metrics["grade"] == GRADE_UNRELIABLE:
        flag = metrics["flag"] or "audio_unreliable"
    elif metrics["grade"] == GRADE_DEGRADED and not flag:
        flag = FLAG_AUDIO_DEGRADED

    result = replace(
        result,
        quality_flag=flag,
        separation_quality=metrics["separation_quality"],
        noise_ratio=metrics.get("noise_ratio") if metrics.get("noise_ratio") is not None
        else result.noise_ratio,
    )
    return metrics, result


def _update_model_stats(model: ModelVersion | None, result: PredictResult) -> None:
    if model is None:
        return
    new_count = model.inference_count + 1
    prev_avg = model.avg_confidence or 0
    top1 = result.top1.confidence if result.top1 else 0
    model.inference_count = new_count
    model.avg_confidence = round((prev_avg * (new_count - 1) + top1) / new_count, 4)
    model.save(update_fields=["inference_count", "avg_confidence", "updated_at"])


def _run_provider(provider, task: PredictionTask, asset: MediaAsset, context: dict) -> PredictResult:
    if task.task_type == PredictionTask.TaskType.AUDIO:
        return provider.predict_audio(asset, context)
    return provider.predict_image(asset, context)


def _store_edge_result(task: PredictionTask, result: PredictResult) -> None:
    task.tier = PredictionTask.Tier.EDGE
    task.edge_provider = result.provider
    task.edge_model_version = result.model_version
    task.edge_confidence = result.top1.confidence if result.top1 else None
    task.edge_latency_ms = result.latency_ms
    task.edge_result = _serialize_result(result)
    task.save(update_fields=[
        "tier", "edge_provider", "edge_model_version", "edge_confidence",
        "edge_latency_ms", "edge_result",
    ])


def _mark_escalated(task: PredictionTask, reason: str) -> None:
    """标记上云并切换到云端模型，便于后续统计与模型指标归集。"""
    cloud_model, is_gray = route_model(
        model_task_type(task.task_type), task.asset.device, tier=PredictionTask.Tier.CLOUD,
    )
    task.tier = PredictionTask.Tier.CLOUD
    task.escalated = True
    task.escalation_reason = reason
    task.model = cloud_model
    task.model_version = cloud_model.version if cloud_model else ""
    task.is_gray = is_gray
    task.save(update_fields=[
        "tier", "escalated", "escalation_reason", "model", "model_version", "is_gray",
    ])


def _defer_for_budget(task: PredictionTask) -> dict:
    """云端日预算耗尽且边缘置信度不足：顺延到次日，避免落低质量记录。"""
    next_day = (timezone.localtime() + timedelta(days=1)).replace(
        hour=0, minute=5, second=0, microsecond=0,
    )
    task.status = PredictionTask.Status.PENDING
    task.error_code = "cloud_budget_exhausted"
    task.error_message = "云端日预算已用尽，任务顺延至次日"
    task.next_retry_at = next_day
    task.finished_at = None
    task.save(update_fields=["status", "error_code", "error_message", "next_retry_at", "finished_at"])
    return {"status": task.status, "retryable": False, "attempts": task.attempts,
            "error_code": "cloud_budget_exhausted"}


def _finish_success(task: PredictionTask, asset: MediaAsset, result: PredictResult,
                    decided_by: str) -> dict:
    audio_quality, result = _apply_audio_quality(asset, result)
    record = _create_record(task, asset, result, audio_quality, decided_by)
    _update_model_stats(task.model, result)
    task.status = PredictionTask.Status.SUCCEEDED
    task.provider = result.provider
    task.model_version = (
        result.model_version or task.model_version
        if decided_by == PredictionTask.DecidedBy.EDGE
        else (task.model_version or result.model_version)
    )
    task.latency_ms = result.latency_ms
    task.result_payload = _serialize_result(result, audio_quality)
    # 像素级分割结果独立落库（前端单独查询/渲染）
    task.segmentation_result = {
        "model_version": result.raw.get("seg_model_version", ""),
        "latency_ms": result.raw.get("latency_ms", {}).get("seg", 0),
        "segmentations": result.raw.get("segmentations", []),
        "seg_count": result.raw.get("segmentations_count", 0),
    }
    task.decided_by = decided_by
    task.tier = (
        PredictionTask.Tier.EDGE
        if decided_by == PredictionTask.DecidedBy.EDGE
        else PredictionTask.Tier.CLOUD
    )
    if decided_by == PredictionTask.DecidedBy.CLOUD:
        task.cloud_confidence = result.top1.confidence if result.top1 else None
    task.record = record
    task.finished_at = timezone.now()
    task.save()
    if record is not None:
        _auto_confirm_record(record, task)
    return {"status": task.status, "retryable": False, "attempts": task.attempts,
            "record_id": record.id if record else None, "decided_by": decided_by,
            "escalated": task.escalated, "escalation_reason": task.escalation_reason}


def _auto_confirm_record(record: MonitorRecord, task: PredictionTask) -> None:
    """高置信度记录自动确认并登记训练样本；不满足条件则留待人工复核。"""
    if not should_auto_confirm(record):
        return
    record.review_status = MonitorRecord.ReviewStatus.CONFIRMED
    record.reviewed_at = timezone.now()
    suffix = "高置信度自动确认"
    record.remark = f"{record.remark}；{suffix}" if record.remark else suffix
    record.save(update_fields=["review_status", "reviewed_at", "remark"])

    from apps.users.audit import audit
    audit(
        None, "review",
        target_type="monitor_record", target_id=record.id,
        target_label=f"记录#{record.id} {record.species.chinese_name if record.species else ''}",
        detail=f"系统自动确认（置信 {(record.confidence or 0) * 100:.1f}%，模型 {task.model_version or '未知'}）",
    )

    from apps.records.tasks import enqueue_training_sample
    # 事务内触发时延后到提交后投递，避免 Worker 读不到未提交的记录
    transaction.on_commit(lambda: enqueue_training_sample(record.id))


def execute_task(task_id: int) -> dict | None:
    """执行识别任务：边缘轻量模型先行，满足条件直判，否则上云。"""
    with transaction.atomic():
        task = (
            PredictionTask.objects.select_for_update()
            .select_related("asset", "asset__device", "model")
            .filter(pk=task_id)
            .first()
        )
        if task is None or task.status == PredictionTask.Status.SUCCEEDED:
            return None
        if task.status == PredictionTask.Status.SKIPPED:
            return None
        task.status = PredictionTask.Status.RUNNING
        task.attempts += 1
        task.started_at = timezone.now()
        task.error_code = ""
        task.error_message = ""
        task.next_retry_at = None
        task.save(update_fields=[
            "status", "attempts", "started_at", "error_code", "error_message", "next_retry_at",
        ])

    asset = task.asset
    context = {
        "device_id": asset.device_id,
        "survey_area_id": asset.survey_area_id,
        "request_id": task.request_id,
        "tier": task.tier,
    }
    settings = edge_settings()

    # ── 第一级：边缘端轻量模型 ────────────────────────────────
    if task.tier == PredictionTask.Tier.EDGE and settings["enabled"]:
        try:
            edge_result = _run_provider(get_edge_provider(), task, asset, context)
        except ProviderError as exc:
            if not settings["fallback_to_cloud"]:
                return _handle_failure(task, exc.code, str(exc), exc.retryable)
            _mark_escalated(task, PredictionTask.EscalationReason.EDGE_ERROR)
        except Exception as exc:  # 边缘异常默认降级到云端
            logger.exception("边缘推理异常 task=%s", task.request_id)
            if not settings["fallback_to_cloud"]:
                return _handle_failure(task, "edge_internal_error", str(exc), True)
            _mark_escalated(task, PredictionTask.EscalationReason.EDGE_ERROR)
        else:
            _store_edge_result(task, edge_result)
            accept, reason = decide_edge(edge_result, settings)

            if accept:
                return _finish_success(task, asset, edge_result, PredictionTask.DecidedBy.EDGE)

            # 云端预算门控：预算耗尽时，高置信边缘结果降级直判，否则顺延
            budget = settings["cloud_daily_budget"]
            if budget > 0 and cloud_budget_used(exclude_task_id=task.id) >= budget:
                top1 = edge_result.top1
                if top1 and top1.confidence >= settings["budget_accept_floor"]:
                    degraded = replace(
                        edge_result,
                        quality_flag=edge_result.quality_flag or "edge_budget_degraded",
                    )
                    task.escalated = True
                    task.escalation_reason = PredictionTask.EscalationReason.BUDGET_EXHAUSTED
                    task.save(update_fields=["escalated", "escalation_reason"])
                    return _finish_success(task, asset, degraded, PredictionTask.DecidedBy.EDGE)
                return _defer_for_budget(task)

            _mark_escalated(task, reason)

    # ── 第二级：云端大模型 ────────────────────────────────────
    provider = get_provider()
    try:
        result = _run_provider(provider, task, asset, context)
    except ProviderError as exc:
        return _handle_failure(task, exc.code, str(exc), exc.retryable)
    except Exception as exc:  # 未预期异常按可重试处理
        logger.exception("识别任务 %s 执行异常", task.request_id)
        return _handle_failure(task, "internal_error", str(exc), True)

    return _finish_success(task, asset, result, PredictionTask.DecidedBy.CLOUD)



def _handle_failure(task: PredictionTask, code: str, message: str, retryable: bool) -> dict:
    will_retry = retryable and task.attempts < task.max_attempts
    task.error_code = code[:50]
    task.error_message = message[:500]
    task.finished_at = timezone.now()
    if will_retry:
        task.status = PredictionTask.Status.PENDING
        task.next_retry_at = timezone.now() + timedelta(seconds=_next_backoff(task.attempts))
    else:
        task.status = PredictionTask.Status.FAILED
    task.save(update_fields=[
        "status", "error_code", "error_message", "finished_at", "next_retry_at",
    ])
    return {"status": task.status, "retryable": will_retry, "attempts": task.attempts,
            "error_code": code}


# ── 队列调度 ─────────────────────────────────────────────────


def dispatch_task(task: PredictionTask) -> bool:
    """投递 Celery 任务；Broker 不可用时保留 pending，由巡检任务补偿。"""
    from .tasks import run_prediction_task

    try:
        run_prediction_task.delay(task.id)
        return True
    except Exception:
        logger.warning("任务 %s 投递失败，等待巡检补偿", task.request_id, exc_info=True)
        return False


def retry_task(task: PredictionTask) -> PredictionTask:
    task.status = PredictionTask.Status.PENDING
    task.error_code = ""
    task.error_message = ""
    task.next_retry_at = None
    task.finished_at = None
    task.save(update_fields=["status", "error_code", "error_message", "next_retry_at", "finished_at"])
    dispatch_task(task)
    return task


def recover_pending_tasks(limit: int = 50) -> int:
    """补偿未成功投递或到期重试的 pending 任务。"""
    now = timezone.now()
    idle = now - timedelta(minutes=2)
    from django.db.models import Q

    qs = PredictionTask.objects.filter(status=PredictionTask.Status.PENDING).filter(
        Q(next_retry_at__isnull=True, created_at__lte=idle) | Q(next_retry_at__lte=now)
    ).order_by("created_at")[:limit]

    count = 0
    for task in qs:
        if dispatch_task(task):
            count += 1
    return count


def scan_stuck_tasks() -> int:
    """回收长时间停留在 running 的任务，超过最大次数则判失败。"""
    deadline = timezone.now() - timedelta(minutes=STUCK_TASK_MINUTES)
    stuck = PredictionTask.objects.filter(status=PredictionTask.Status.RUNNING,
                                          started_at__lt=deadline)
    count = 0
    for task in stuck:
        if task.attempts >= task.max_attempts:
            task.status = PredictionTask.Status.FAILED
            task.error_code = "stuck_timeout"
            task.error_message = "任务执行超时且已达最大重试次数"
            task.finished_at = timezone.now()
            task.save(update_fields=["status", "error_code", "error_message", "finished_at"])
        else:
            task.status = PredictionTask.Status.PENDING
            task.next_retry_at = timezone.now()
            task.save(update_fields=["status", "next_retry_at"])
        count += 1
    return count


def backlog_count() -> int:
    return PredictionTask.objects.filter(status=PredictionTask.Status.PENDING).count()


def check_backlog(threshold: int) -> int:
    """积压超阈值时写一条预警，1 小时内不重复告警。"""
    from apps.alerts.models import Alert

    pending = backlog_count()
    if pending <= threshold:
        return pending

    since = timezone.now() - timedelta(hours=1)
    exists = Alert.objects.filter(type=Alert.Type.DATA_ANOMALY, title__contains="识别任务积压",
                                  created_at__gte=since).exists()
    if not exists:
        Alert.objects.create(
            type=Alert.Type.DATA_ANOMALY,
            level=Alert.Level.WARNING,
            title="识别任务积压告警",
            description=f"当前待处理识别任务 {pending} 个，已超过阈值 {threshold}，请检查推理服务与 Worker。",
        )
    return pending


# ── 边缘结果上报 ─────────────────────────────────────────────


def _result_from_payload(payload: dict, *, provider: str, latency_ms: int) -> PredictResult:
    items = [
        PredictionItem(
            species_id=item.get("species_id") or item.get("category_id"),
            chinese_name=item.get("chinese_name") or item.get("name", ""),
            latin_name=item.get("latin_name", ""),
            confidence=float(item.get("confidence", 0)),
            count=int(item.get("count", 1)),
            bbox=item.get("bbox"),
            severity=item.get("severity", "none"),
        )
        for item in payload.get("top_k", [])
    ]
    return PredictResult(
        top_k=items,
        model_version=payload.get("model_version", ""),
        provider=provider,
        latency_ms=latency_ms,
        quality_flag=payload.get("quality_flag", ""),
        noise_ratio=payload.get("noise_ratio", 0.0),
        separation_quality=payload.get("separation_quality"),
        raw=payload.get("raw", {}),
    )


def report_edge_result(asset: MediaAsset, payload: dict, *, provider: str = "edge",
                       latency_ms: int = 0) -> dict:
    """接收边缘网关已完成的结果：直接判定，或上云复核。

    这是真实边缘部署的主路径——边缘侧推理，平台只负责策略与云端回补。
    """
    task_type = (
        PredictionTask.TaskType.AUDIO
        if asset.source_type == MediaAsset.SourceType.AUDIO
        else PredictionTask.TaskType.IMAGE
    )
    with transaction.atomic():
        task = (
            PredictionTask.objects.select_for_update()
            .filter(asset=asset)
            .order_by("-created_at")
            .first()
        )
        if task and task.status == PredictionTask.Status.SUCCEEDED:
            return {"decision": "ignored", "reason": "already_succeeded",
                    "task_id": task.id, "record_id": task.record_id}
        if task is None:
            task = PredictionTask.objects.create(
                request_id=f"req_{uuid.uuid4().hex[:16]}",
                asset=asset,
                task_type=task_type,
                tier=PredictionTask.Tier.EDGE,
            )
        task.status = PredictionTask.Status.RUNNING
        task.started_at = task.started_at or timezone.now()
        task.attempts = max(task.attempts, 1)
        task.error_code = ""
        task.error_message = ""
        task.save(update_fields=["status", "started_at", "attempts", "error_code", "error_message"])

        result = _result_from_payload(payload, provider=provider, latency_ms=latency_ms)
        _store_edge_result(task, result)
        policy = edge_settings()
        accept, reason = decide_edge(result, policy)

        if accept:
            outcome = _finish_success(task, asset, result, PredictionTask.DecidedBy.EDGE)
            return {"decision": "accepted", "reason": "", "task_id": task.id,
                    "record_id": outcome.get("record_id")}

        _mark_escalated(task, reason)
        task.status = PredictionTask.Status.PENDING
        task.finished_at = None
        task.next_retry_at = None
        task.save(update_fields=["status", "finished_at", "next_retry_at"])

    transaction.on_commit(lambda: dispatch_task(task))
    return {"decision": "escalated", "reason": reason, "task_id": task.id, "record_id": None}


# ── 调度统计 ─────────────────────────────────────────────────


def scheduling_stats(days: int = 7) -> dict:
    since = timezone.now() - timedelta(days=max(days, 1))
    qs = PredictionTask.objects.filter(created_at__gte=since)
    edge_qs = qs.exclude(edge_confidence__isnull=True)

    total = qs.count()
    edge_count = edge_qs.count()
    accepted = edge_qs.filter(
        status=PredictionTask.Status.SUCCEEDED,
        decided_by=PredictionTask.DecidedBy.EDGE,
    ).count()
    escalated = qs.filter(escalated=True).count()
    cloud_only = qs.filter(tier=PredictionTask.Tier.CLOUD, escalated=False).count()
    reasons = list(
        qs.filter(escalated=True).exclude(escalation_reason="")
        .values("escalation_reason").annotate(count=Count("id")).order_by("-count")
    )
    reason_labels = dict(PredictionTask.EscalationReason.choices)
    reasons = [
        {"reason": row["escalation_reason"],
         "label": reason_labels.get(row["escalation_reason"], row["escalation_reason"]),
         "count": row["count"]}
        for row in reasons
    ]

    avg_edge_latency = edge_qs.aggregate(value=Avg("edge_latency_ms"))["value"]
    avg_cloud_latency = qs.filter(decided_by=PredictionTask.DecidedBy.CLOUD).aggregate(
        value=Avg("latency_ms"),
    )["value"]

    clients = qs.filter(
        decided_by=PredictionTask.DecidedBy.CLOUD, edge_confidence__isnull=False,
    ).only("edge_result", "result_payload")[:500]
    compared = agreed = 0
    deltas = []
    for task in clients:
        edge_top = (task.edge_result or {}).get("top_k") or []
        cloud_top = (task.result_payload or {}).get("top_k") or []
        if not edge_top or not cloud_top:
            continue
        compared += 1
        if edge_top[0].get("species_id") == cloud_top[0].get("species_id"):
            agreed += 1
        deltas.append(
            float(cloud_top[0].get("confidence", 0)) - float(edge_top[0].get("confidence", 0)),
        )

    today = timezone.now().date()
    today_qs = qs.filter(started_at__date=today)
    budget = _cfg_int("edge_cloud_daily_budget", 0)

    # 按天聚合趋势（边缘直判 / 上云 / 云端调用 / 节省调用）
    daily = (
        qs.annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(
            total=Count("id"),
            edge_accepted=Count("id", filter=Q(decided_by=PredictionTask.DecidedBy.EDGE)),
            escalated=Count("id", filter=Q(escalated=True)),
            cloud_calls=Count("id", filter=Q(tier=PredictionTask.Tier.CLOUD)),
        )
        .order_by("day")
    )
    daily_trend = [
        {
            "date": row["day"].isoformat(),
            "total": row["total"],
            "edgeAccepted": row["edge_accepted"],
            "escalated": row["escalated"],
            "cloudCalls": row["cloud_calls"],
            "saved": row["edge_accepted"],
        }
        for row in daily
    ]

    return {
        "days": days,
        "totalTasks": total,
        "edgeTasks": edge_count,
        "edgeAccepted": accepted,
        "escalated": escalated,
        "cloudOnly": cloud_only,
        "cloudCalls": qs.filter(tier=PredictionTask.Tier.CLOUD).count(),
        "cloudCallsSaved": accepted,
        "escalationRate": round(escalated / edge_count * 100, 1) if edge_count else 0,
        "acceptRate": round(accepted / edge_count * 100, 1) if edge_count else 0,
        "todayEdgeAccepted": today_qs.filter(decided_by=PredictionTask.DecidedBy.EDGE).count(),
        "todayEscalated": today_qs.filter(escalated=True).count(),
        "todayCloudCalls": today_qs.filter(tier=PredictionTask.Tier.CLOUD).count(),
        "avgEdgeLatencyMs": round(avg_edge_latency, 1) if avg_edge_latency else 0,
        "avgCloudLatencyMs": round(avg_cloud_latency, 1) if avg_cloud_latency else 0,
        "agreementRate": round(agreed / compared * 100, 1) if compared else None,
        "avgConfidenceDelta": round(sum(deltas) / len(deltas), 4) if deltas else None,
        "comparedTasks": compared,
        "escalationReasons": reasons,
        "cloudBudget": budget,
        "cloudBudgetUsedToday": cloud_budget_used(),
        "dailyTrend": daily_trend,
        "policy": {**edge_settings(), "provider": getattr(settings, "EDGE_PROVIDER", "edge")},
    }

