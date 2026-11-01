"""Celery 任务：周期重建最近时间窗的跨模态证据簇。"""
from __future__ import annotations

import logging

from celery import shared_task

from .services import maybe_rebuild_recent

logger = logging.getLogger(__name__)


@shared_task(name="fusion.rebuild_recent_clusters")
def rebuild_recent_clusters_job():
    # Beat 每分钟触发一次，实际重建频率由 fusion_rebuild_interval_minutes 控制
    summary = maybe_rebuild_recent()
    if summary.get("clusters"):
        logger.info("证据融合重建完成：%s", summary)
    return summary
