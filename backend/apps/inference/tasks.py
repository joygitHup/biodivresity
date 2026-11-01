"""Celery 任务：识别执行、失败重试、巡检与积压告警。"""
from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import PredictionTask
from .services import (
    check_backlog,
    execute_task,
    recover_pending_tasks,
    retry_task as _retry_task_sync,
    scan_stuck_tasks,
)

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="inference.run_prediction_task")
def run_prediction_task(self, task_id: int):
    """执行识别任务；可重试错误按退避时间重新投递。"""
    outcome = execute_task(task_id)
    if not outcome:
        return {"task_id": task_id, "status": "skipped"}

    if outcome.get("retryable"):
        task = PredictionTask.objects.filter(pk=task_id).first()
        countdown = 10
        if task and task.next_retry_at:
            countdown = max(int((task.next_retry_at - timezone.now()).total_seconds()), 1)
        logger.info("识别任务 %s 第 %s 次失败，%ss 后重试（%s）",
                    task_id, outcome.get("attempts"), countdown, outcome.get("error_code"))
        raise self.retry(countdown=countdown)

    return outcome


@shared_task(name="inference.retry_task")
def retry_task_async(task_id: int) -> dict:
    """异步重试：将任务重置为 pending 并投递执行。"""
    task = PredictionTask.objects.filter(pk=task_id).first()
    if not task:
        return {"task_id": task_id, "status": "not_found"}
    _retry_task_sync(task)
    return {"task_id": task_id, "status": "retrying", "request_id": task.request_id}


@shared_task(name="inference.recover_pending_tasks")
def recover_pending_tasks_job():
    """补偿未投递成功或已到重试时间的 pending 任务。"""
    count = recover_pending_tasks()
    return {"dispatched": count}


@shared_task(name="inference.scan_stuck_tasks")
def scan_stuck_tasks_job():
    """回收卡在 running 状态的任务。"""
    count = scan_stuck_tasks()
    if count:
        logger.warning("回收卡死识别任务 %s 个", count)
    return {"recovered": count}


@shared_task(name="inference.check_backlog")
def check_backlog_job():
    """积压超过阈值时写入预警。"""
    threshold = getattr(settings, "INFERENCE_BACKLOG_THRESHOLD", 500)
    pending = check_backlog(threshold)
    return {"pending": pending, "threshold": threshold}


@shared_task(name="inference.cleanup_old_tasks")
def cleanup_old_tasks_job(days: int = 30):
    """清理过期已完成任务记录，保留统计所需的近期数据。"""
    deadline = timezone.now() - timedelta(days=days)
    deleted, _ = PredictionTask.objects.filter(
        status__in=[PredictionTask.Status.SUCCEEDED, PredictionTask.Status.SKIPPED],
        finished_at__lt=deadline,
    ).delete()
    return {"deleted": deleted}


__all__ = [
    "check_backlog_job",
    "cleanup_old_tasks_job",
    "recover_pending_tasks_job",
    "retry_task_async",
    "run_prediction_task",
    "scan_stuck_tasks_job",
]
