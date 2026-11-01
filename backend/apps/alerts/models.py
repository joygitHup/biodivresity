from django.db import models
from apps.survey_areas.models import SurveyArea


class AlertQuerySet(models.QuerySet):
    def unread(self):
        return self.filter(is_read=False)

    def critical(self):
        return self.filter(level="critical")


class Alert(models.Model):
    class Type(models.TextChoices):
        DEVICE_OFFLINE = "device_offline", "设备离线"
        INVASIVE_SPECIES = "invasive_species", "入侵物种"
        PROTECTION_ANOMALY = "protection_anomaly", "保护物种异常"
        DATA_ANOMALY = "data_anomaly", "数据异常"
        DIVERSITY_DECLINE = "diversity_decline", "多样性下降"
        TRAINING_APPROVAL = "training_approval", "训练报告审批"

    class Level(models.TextChoices):
        INFO = "info", "提示"
        WARNING = "warning", "警告"
        CRITICAL = "critical", "严重"

    class Source(models.TextChoices):
        MANUAL = "manual", "人工"
        FUSION = "fusion", "证据融合"
        INFERENCE = "inference", "识别任务"
        TRAINING = "training", "模型训练"
        SYSTEM = "system", "系统"

    type = models.CharField(max_length=30, choices=Type.choices, verbose_name="类型")
    level = models.CharField(max_length=20, choices=Level.choices, default=Level.INFO, verbose_name="级别")
    title = models.CharField(max_length=200, verbose_name="标题")
    description = models.TextField(blank=True, verbose_name="描述")
    survey_area = models.ForeignKey(SurveyArea, on_delete=models.SET_NULL, null=True, related_name="alerts", verbose_name="关联样区")
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.MANUAL, verbose_name="来源")
    source_ref = models.CharField(max_length=64, blank=True, db_index=True, verbose_name="来源引用",
                                  help_text="用于自动预警去重，如 fusion:集群ID")
    is_read = models.BooleanField(default=False, verbose_name="是否已读")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = AlertQuerySet.as_manager()

    class Meta:
        db_table = "alert"
        verbose_name = "预警"
        verbose_name_plural = verbose_name
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["is_read", "-created_at"]),
            models.Index(fields=["level", "-created_at"]),
        ]
