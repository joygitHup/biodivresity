from django.db import models

from apps.users.models import User


class DatasetSnapshot(models.Model):
    """训练数据快照：冻结一次训练使用的样本集合与划分，保证结果可复现。"""

    media_type = models.CharField(max_length=10, default="image", verbose_name="媒体类型")
    filters = models.JSONField(default=dict, blank=True, verbose_name="筛选条件")
    sample_ids = models.JSONField(default=list, blank=True, verbose_name="样本ID清单")
    sample_count = models.IntegerField(default=0, verbose_name="样本总数")
    class_count = models.IntegerField(default=0, verbose_name="类别数")
    train_count = models.IntegerField(default=0, verbose_name="训练集数量")
    val_count = models.IntegerField(default=0, verbose_name="验证集数量")
    test_count = models.IntegerField(default=0, verbose_name="测试集数量")
    class_stats = models.JSONField(default=list, blank=True, verbose_name="类别分布")
    source_stats = models.JSONField(default=dict, blank=True, verbose_name="标签来源分布")
    sample_hash = models.CharField(max_length=64, blank=True, db_index=True, verbose_name="样本集合哈希")
    frozen_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="frozen_snapshots", verbose_name="冻结人",
    )
    frozen_at = models.DateTimeField(null=True, blank=True, verbose_name="冻结时间")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        db_table = "dataset_snapshot"
        verbose_name = "训练数据快照"
        verbose_name_plural = verbose_name
        ordering = ["-created_at"]

    def __str__(self):
        return f"快照#{self.id} {self.media_type} {self.sample_count}条"


class TrainingRun(models.Model):
    """一次训练任务：冻结快照 → 异步执行 → 产出指标与待审批报告。"""

    class Status(models.TextChoices):
        QUEUED = "queued", "排队中"
        RUNNING = "running", "训练中"
        SUCCEEDED = "succeeded", "已完成"
        FAILED = "failed", "失败"
        CANCELLED = "cancelled", "已取消"

    class MediaType(models.TextChoices):
        IMAGE = "image", "图像"
        AUDIO = "audio", "音频"
        VIDEO = "video", "视频"

    media_type = models.CharField(max_length=10, choices=MediaType.choices,
                                  default=MediaType.IMAGE, db_index=True, verbose_name="模态")
    model_family = models.CharField(max_length=40, default="yolo", verbose_name="模型族")
    status = models.CharField(max_length=12, choices=Status.choices,
                              default=Status.QUEUED, db_index=True, verbose_name="任务状态")
    snapshot = models.ForeignKey(
        DatasetSnapshot, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="runs", verbose_name="数据快照",
    )
    filters = models.JSONField(default=dict, blank=True, verbose_name="样本筛选条件")
    hyperparams = models.JSONField(default=dict, blank=True, verbose_name="超参数")
    metrics = models.JSONField(default=dict, blank=True, verbose_name="训练指标")
    artifact = models.CharField(max_length=500, blank=True, verbose_name="产物路径")
    report_ready = models.BooleanField(default=False, verbose_name="报告已生成")
    celery_task_id = models.CharField(max_length=64, blank=True, verbose_name="Celery任务ID")
    retry_count = models.IntegerField(default=0, verbose_name="重试次数")
    error_message = models.TextField(blank=True, verbose_name="失败原因")
    submitted_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="training_runs", verbose_name="提交人",
    )
    target_model_version = models.ForeignKey(
        "models_app.ModelVersion", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="training_runs", verbose_name="目标模型版本",
    )
    started_at = models.DateTimeField(null=True, blank=True, verbose_name="开始时间")
    finished_at = models.DateTimeField(null=True, blank=True, verbose_name="结束时间")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        db_table = "training_run"
        verbose_name = "训练任务"
        verbose_name_plural = verbose_name
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["media_type", "status"]),
        ]

    @property
    def latest_report(self):
        return self.reports.order_by("-revision").first()

    def __str__(self):
        return f"训练#{self.id} {self.media_type} {self.status}"


class TrainingReport(models.Model):
    """训练结果报告：强制生成，审批通过后才允许模型灰度/上线。"""

    class Status(models.TextChoices):
        REPORT_READY = "report_ready", "报告已生成"
        PENDING_REVIEW = "pending_review", "待一级审核"
        PENDING_FINAL = "pending_final", "待终审"
        APPROVED = "approved", "已通过"
        REJECTED = "rejected", "已驳回"

    run = models.ForeignKey(
        TrainingRun, on_delete=models.CASCADE, related_name="reports", verbose_name="训练任务",
    )
    revision = models.IntegerField(default=1, verbose_name="报告版本")
    status = models.CharField(max_length=16, choices=Status.choices,
                              default=Status.REPORT_READY, db_index=True, verbose_name="审批状态")
    approval_level = models.IntegerField(default=1, verbose_name="审批层级数")
    metrics = models.JSONField(default=dict, blank=True, verbose_name="指标")
    comparison = models.JSONField(default=dict, blank=True, verbose_name="与线上版本对比")
    quality_gate = models.JSONField(default=dict, blank=True, verbose_name="质量门禁")
    conclusion = models.TextField(blank=True, verbose_name="结论摘要")
    html_path = models.CharField(max_length=500, blank=True, verbose_name="报告HTML路径")
    pdf_path = models.CharField(max_length=500, blank=True, verbose_name="报告PDF路径")
    generated_at = models.DateTimeField(null=True, blank=True, verbose_name="生成时间")
    submitted_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="submitted_reports", verbose_name="提交人",
    )
    submitted_at = models.DateTimeField(null=True, blank=True, verbose_name="提交时间")
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="reviewed_training_reports", verbose_name="一级审核人",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name="一级审核时间")
    review_comment = models.CharField(max_length=500, blank=True, verbose_name="一级审核意见")
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="approved_training_reports", verbose_name="终审人",
    )
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name="终审时间")
    approval_comment = models.CharField(max_length=500, blank=True, verbose_name="终审意见")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        db_table = "training_report"
        verbose_name = "训练报告"
        verbose_name_plural = verbose_name
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["run", "revision"], name="uniq_report_run_revision"),
        ]

    def __str__(self):
        return f"报告#{self.id} 训练#{self.run_id} r{self.revision} {self.status}"
