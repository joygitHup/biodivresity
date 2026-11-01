"""训练任务异步执行：冻结快照 → Mock 训练 → 生成报告 → 自动登记模型版本。"""
from __future__ import annotations

import logging

from celery import shared_task
from django.utils import timezone

from apps.records.services import config_int
from apps.users.audit import audit

from .models import TrainingRun
from .services import (
    create_snapshot,
    generate_report,
    register_model_version,
    simulate_metrics,
)

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="training.run_training")
def run_training(self, run_id: int) -> dict:
    run = (
        TrainingRun.objects
        .select_related("snapshot", "submitted_by")
        .filter(pk=run_id)
        .first()
    )
    if run is None:
        return {"status": "missing", "run_id": run_id}
    if run.status not in (TrainingRun.Status.QUEUED, TrainingRun.Status.RUNNING):
        return {"status": "skipped", "run_id": run_id, "current": run.status}

    run.status = TrainingRun.Status.RUNNING
    run.celery_task_id = self.request.id or ""
    run.started_at = run.started_at or timezone.now()
    run.error_message = ""
    run.save(update_fields=["status", "celery_task_id", "started_at", "error_message"])

    try:
        if run.snapshot is None:
            run.snapshot = create_snapshot(run, run.submitted_by)
            run.save(update_fields=["snapshot"])

        run.metrics = simulate_metrics(run)
        run.artifact = f"training_artifacts/run_{run.id}/model.pt"
        run.save(update_fields=["metrics", "artifact"])

        report = generate_report(run)

        run.report_ready = True
        run.status = TrainingRun.Status.SUCCEEDED
        run.finished_at = timezone.now()
        run.save(update_fields=["report_ready", "status", "finished_at"])

        register_model_version(run, report)
        audit(
            run.submitted_by, "create",
            target_type="training_run", target_id=run.id,
            target_label=f"训练任务#{run.id}",
            detail=f"训练完成并生成报告 r{report.revision}，等待审批",
        )
        return {"status": "succeeded", "run_id": run.id, "report_id": report.id}

    except Exception as exc:  # noqa: BLE001 - 训练失败需要补偿与重试
        logger.exception("训练任务失败 run=%s", run_id)
        retry_max = max(config_int("training_retry_max", 3), 0)
        run.retry_count += 1
        run.error_message = str(exc)[:2000]
        if run.retry_count <= retry_max:
            run.status = TrainingRun.Status.QUEUED
            run.save(update_fields=["retry_count", "error_message", "status"])
            # 指数退避：10s、20s、40s ...
            raise self.retry(exc=exc, countdown=10 * (2 ** (run.retry_count - 1)))
        run.status = TrainingRun.Status.FAILED
        run.finished_at = timezone.now()
        run.save(update_fields=["retry_count", "error_message", "status", "finished_at"])
        return {"status": "failed", "run_id": run.id, "error": run.error_message}
