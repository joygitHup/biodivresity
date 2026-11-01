"""训练样本池任务：确认记录自动登记为样本，支持存量回填。"""
from __future__ import annotations

import logging

from celery import shared_task

from .models import MonitorRecord, TrainingSample
from .services import config_bool, config_float

logger = logging.getLogger(__name__)

CONFIRMED_STATUSES = (
    MonitorRecord.ReviewStatus.CONFIRMED,
    MonitorRecord.ReviewStatus.CORRECTED,
)


def _media_enabled(media_type: str) -> bool:
    if media_type == MonitorRecord.MediaType.AUDIO:
        return config_bool("training_audio_enabled", True)
    if media_type == MonitorRecord.MediaType.VIDEO:
        return config_bool("training_video_enabled", True)
    return True


def upsert_training_sample(record: MonitorRecord) -> TrainingSample | None:
    """把一条已确认记录登记/更新为训练样本；不满足条件时清理旧样本。"""
    label = record.corrected_species or record.species
    eligible = (
        record.review_status in CONFIRMED_STATUSES
        and label is not None
        and record.asset_id is not None
    )
    if not eligible:
        TrainingSample.objects.filter(record=record).delete()
        return None
    # 开关关闭只影响新登记，已有样本保持原状
    if not config_bool("training_sample_enabled", True) or not _media_enabled(record.media_type):
        return TrainingSample.objects.filter(record=record).first()

    task = record.tasks.order_by("-created_at").first()
    asset = record.asset
    seg = (task.segmentation_result or {}) if task else {}
    seg_items = [
        {k: v for k, v in item.items() if k != "mask_rle"}
        for item in (seg.get("segmentations") or [])[:50]
    ]

    defaults = {
        "asset": asset,
        "media_type": record.media_type,
        "label": label,
        "label_source": (
            TrainingSample.LabelSource.REVIEW
            if record.reviewed_by_id else TrainingSample.LabelSource.AUTO
        ),
        "confidence": record.confidence or 0,
        "quality_flag": record.quality_flag or "",
        "model_version": task.model_version if task else "",
        "provider": task.provider if task else "",
        "tier": task.tier if task else "",
        "segmentation": {
            "model_version": seg.get("model_version", ""),
            "count": len(seg.get("segmentations") or []),
            "items": seg_items,
        },
        "audio_meta": {
            "duration": asset.duration if asset else None,
            "snr_db": asset.snr_db if asset else None,
            "vad_ratio": asset.vad_ratio if asset else None,
            "separation_quality": asset.separation_quality if asset else None,
            "reliability_score": asset.reliability_score if asset else None,
            "grade": asset.reliability_grade if asset else "",
        } if record.media_type == MonitorRecord.MediaType.AUDIO else {},
        "video_meta": {
            "duration": asset.duration if asset else None,
            "width": asset.width if asset else None,
            "height": asset.height if asset else None,
            "frame_fps": config_float("video_frame_fps", 1.0),
        } if record.media_type == MonitorRecord.MediaType.VIDEO else {},
    }

    sample = TrainingSample.objects.filter(record=record).first()
    if sample is None:
        return TrainingSample.objects.create(record=record, **defaults)
    # 标签变化时重新进入就绪态，等待下次导出
    if sample.label_id != label.id:
        defaults["status"] = TrainingSample.Status.READY
        defaults["exported_at"] = None
    for key, value in defaults.items():
        setattr(sample, key, value)
    sample.save()
    return sample


@shared_task(name="records.register_training_sample")
def register_training_sample(record_id: int) -> int | None:
    record = (
        MonitorRecord.objects.select_related(
            "species", "corrected_species", "asset", "reviewed_by",
        ).filter(pk=record_id).first()
    )
    if record is None:
        return None
    sample = upsert_training_sample(record)
    return sample.id if sample else None


@shared_task(name="records.backfill_training_samples")
def backfill_training_samples(batch_size: int = 500) -> int:
    """把历史已确认记录批量补登记进样本池（幂等，可重复执行）。"""
    queryset = (
        MonitorRecord.objects.filter(review_status__in=CONFIRMED_STATUSES)
        .exclude(training_sample__isnull=False)
        .select_related("species", "corrected_species", "asset", "reviewed_by")
        .prefetch_related("tasks")
        .order_by("id")
    )
    count = 0
    for record in queryset.iterator(chunk_size=batch_size):
        if upsert_training_sample(record) is not None:
            count += 1
    return count


def enqueue_training_sample(record_id: int) -> None:
    """投递登记任务；Broker 不可用时退化为同步登记，避免样本丢失。"""
    try:
        register_training_sample.delay(record_id)
    except Exception:
        logger.warning("训练样本登记任务投递失败，改为同步登记 record=%s", record_id)
        try:
            register_training_sample(record_id)
        except Exception:
            logger.exception("训练样本同步登记失败 record=%s", record_id)
