from django.db import models


class ModelVersion(models.Model):
    """CNN 模型版本管理."""

    class Status(models.TextChoices):
        DRAFT = "draft", "草稿"
        TESTING = "testing", "测试中"
        STABLE = "stable", "稳定版"
        ACTIVE = "active", "线上使用中"
        ARCHIVED = "archived", "已归档"
        STOPPED = "stopped", "已停用"

    class TaskType(models.TextChoices):
        IMAGE = "image", "图像识别"
        AUDIO = "audio", "声学识别"

    class DeployScope(models.TextChoices):
        GLOBAL = "global", "全局"
        AREA = "area", "按监测区域"
        DEVICE = "device", "按设备"

    class Tier(models.TextChoices):
        EDGE = "edge", "边缘轻量模型"
        CLOUD = "cloud", "云端大模型"

    class ApprovalStatus(models.TextChoices):
        NONE = "none", "无需审批"
        PENDING = "pending", "报告待审批"
        APPROVED = "approved", "报告已通过"
        REJECTED = "rejected", "报告已驳回"

    version = models.CharField(max_length=30, verbose_name="版本号")
    name = models.CharField(max_length=100, verbose_name="模型名称")
    file_path = models.CharField(max_length=500, blank=True, verbose_name="模型文件路径")
    file_hash = models.CharField(max_length=100, blank=True, verbose_name="文件哈希")
    input_size = models.CharField(max_length=20, default="224x224", verbose_name="输入尺寸")
    top1_accuracy = models.FloatField(null=True, blank=True, verbose_name="Top-1准确率(%)")
    top5_accuracy = models.FloatField(null=True, blank=True, verbose_name="Top-5准确率(%)")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, verbose_name="状态")
    tier = models.CharField(
        max_length=10, choices=Tier.choices, default=Tier.CLOUD,
        db_index=True, verbose_name="模型层级",
        help_text="edge 为边缘端轻量模型，cloud 为云端大模型",
    )
    description = models.TextField(blank=True, verbose_name="版本说明")
    inference_count = models.BigIntegerField(default=0, verbose_name="累计推理次数")
    avg_confidence = models.FloatField(default=0, verbose_name="平均置信度")
    reject_rate = models.FloatField(default=0, verbose_name="拒识率(%)")
    is_active = models.BooleanField(default=False, verbose_name="是否当前线上版本")
    task_type = models.CharField(
        max_length=10, choices=TaskType.choices, default=TaskType.IMAGE,
        verbose_name="适用任务类型",
    )
    deploy_scope = models.CharField(
        max_length=10, choices=DeployScope.choices, default=DeployScope.GLOBAL,
        verbose_name="部署范围",
    )
    traffic_ratio = models.IntegerField(
        default=0, verbose_name="灰度比例(%)",
        help_text="0 表示不参与灰度；>0 时按设备哈希分流到该版本",
    )
    # 训练闭环：模型版本由哪次训练产生、对应哪份报告，发布前需审批通过
    training_run = models.ForeignKey(
        "training.TrainingRun", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="model_versions", verbose_name="来源训练任务",
    )
    training_report = models.ForeignKey(
        "training.TrainingReport", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="models", verbose_name="审批报告",
    )
    approval_status = models.CharField(
        max_length=12, choices=ApprovalStatus.choices, default=ApprovalStatus.NONE,
        db_index=True, verbose_name="报告审批状态",
        help_text="由训练产生的模型版本需报告审批通过后才能灰度/上线",
    )
    approved_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="approved_model_versions", verbose_name="审批人",
    )
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name="审批时间")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "model_version"
        verbose_name = "模型版本"
        verbose_name_plural = verbose_name
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} {self.version}"
