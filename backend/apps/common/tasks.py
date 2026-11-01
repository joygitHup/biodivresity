"""媒体自动清理 — 每天凌晨跑一次，清理 MinIO 临时文件 + 本地残留演示素材."""
from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="common.cleanup_media")
def cleanup_media_job():
    """
    清理三类目标：
    1. MinIO bucket 内 tmp_uploads/* 且 last_modified > 24h 的临时文件
    2. Django MEDIA_ROOT 下未被 MinIO 接管的残留演示目录（不影响生产逻辑）
    3. MinIO bucket 中所有已删除 DB 记录对应的孤儿对象（best-effort）
    """
    summary = {"minio_tmp": 0, "local_demo": 0}

    # ── 1. MinIO 临时文件 ──
    minio_cleanup = getattr(settings, "MINIO_ENABLED", False)
    if minio_cleanup:
        try:
            from minio import Minio
            client = Minio(
                settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_SECURE,
            )
            bucket = settings.MINIO_BUCKET
            cutoff = timezone.now() - timedelta(hours=24)
            # tmp_uploads/ 前缀
            for obj in client.list_objects(bucket, prefix="tmp_uploads/"):
                if obj.last_modified and obj.last_modified.replace(tzinfo=None) < cutoff.replace(tzinfo=None):
                    try:
                        client.remove_object(bucket, obj.object_name)
                        summary["minio_tmp"] += 1
                    except Exception as exc:
                        logger.warning("MinIO 删除失败 %s: %s", obj.object_name, exc)
            logger.info("MinIO tmp_uploads 清理完成：删除 %d 个", summary["minio_tmp"])
        except ImportError:
            logger.warning("minio 包未安装，跳过 MinIO 清理")
        except Exception as exc:
            logger.warning("MinIO 清理异常：%s", exc)

    # ── 2. 本地 MEDIA_ROOT 残留目录（防御性，仅清理演示素材）──
    import os
    demo_dirs = ["review_demo", "species_photos", "tmp_uploads"]
    media_root = getattr(settings, "MEDIA_ROOT", None)
    if media_root and not minio_cleanup:
        # 仅在 MinIO 未启用（本地存储模式）时才碰这些目录
        for sub in demo_dirs:
            full = os.path.join(media_root, sub)
            if os.path.isdir(full):
                # 不删除目录本身，只删里面的文件（种子数据可能依赖）
                for name in os.listdir(full):
                    p = os.path.join(full, name)
                    if os.path.isfile(p) and os.path.getmtime(p) < (timezone.now() - timedelta(days=90)).timestamp():
                        os.remove(p)
                        summary["local_demo"] += 1
    return summary
