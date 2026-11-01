from django.db import models
from apps.devices.models import Device
from apps.species.models import Species
from apps.survey_areas.models import SurveyArea


class MonitorRecordQuerySet(models.QuerySet):
    def pending_review(self):
        return self.filter(review_status="pending")

    def by_area(self, area_id):
        return self.filter(survey_area_id=area_id)

    def recent(self, days=7):
        from django.utils import timezone
        from datetime import timedelta
        return self.filter(timestamp__gte=timezone.now() - timedelta(days=days))


class MonitorRecord(models.Model):
    class ReviewStatus(models.TextChoices):
        PENDING = "pending", "待复核"
        CONFIRMED = "confirmed", "已确认"
        REJECTED = "rejected", "已驳回"
        CORRECTED = "corrected", "已纠正"

    class MediaType(models.TextChoices):
        IMAGE = "image", "图片"
        VIDEO = "video", "视频"
        AUDIO = "audio", "音频"

    device = models.ForeignKey(Device, on_delete=models.SET_NULL, null=True, related_name="records", verbose_name="设备")
    survey_area = models.ForeignKey(SurveyArea, on_delete=models.SET_NULL, null=True, related_name="records", verbose_name="样区")
    species = models.ForeignKey(Species, on_delete=models.SET_NULL, null=True, related_name="records", verbose_name="物种")
    timestamp = models.DateTimeField(verbose_name="时间戳")
    lat = models.FloatField(null=True, blank=True, verbose_name="纬度")
    lng = models.FloatField(null=True, blank=True, verbose_name="经度")
    count = models.IntegerField(default=1, verbose_name="数量")
    behavior = models.CharField(max_length=100, blank=True, verbose_name="行为")
    confidence = models.FloatField(default=0, verbose_name="置信度")
    review_status = models.CharField(max_length=20, choices=ReviewStatus.choices, default=ReviewStatus.PENDING, verbose_name="复核状态")
    corrected_species = models.ForeignKey(
        Species, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="corrected_records", verbose_name="修正后物种",
    )
    reviewed_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="reviewed_records", verbose_name="复核人",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name="复核时间")
    quality_flag = models.CharField(max_length=32, blank=True, verbose_name="数据质量标记",
                                     help_text="如 high_noise / unreliable_separation / low_confidence")
    audio_reliability = models.FloatField(null=True, blank=True, verbose_name="声学可靠度")
    audio_grade = models.CharField(max_length=12, blank=True, verbose_name="声学可靠度等级",
                                   help_text="reliable / degraded / unreliable")
    media_url = models.URLField(blank=True, verbose_name="媒体URL")
    media_type = models.CharField(max_length=10, choices=MediaType.choices, default=MediaType.IMAGE, verbose_name="媒体类型")
    # 直接关联原始媒体资产，训练集导出/错分分析可直接取到原始文件
    asset = models.ForeignKey(
        "inference.MediaAsset", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="records", verbose_name="媒体资产",
    )
    remark = models.TextField(blank=True, verbose_name="备注")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = MonitorRecordQuerySet.as_manager()

    class Meta:
        db_table = "monitor_record"
        verbose_name = "监测记录"
        verbose_name_plural = verbose_name
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["review_status", "-timestamp"]),
            models.Index(fields=["device", "-timestamp"]),
            # 融合引擎按时间窗扫描、列表默认按时间倒序，需纯时间索引
            models.Index(fields=["-timestamp"]),
            models.Index(fields=["survey_area", "-timestamp"]),
        ]


class TrainingSample(models.Model):
    """训练样本池：把确认后的监测记录登记为可训练样本，按模态导出。

    一条监测记录最多对应一条样本，标签来源区分自动确认与人工复核，
    便于后续评估自动确认通道的准确率。
    """

    class MediaType(models.TextChoices):
        IMAGE = "image", "图像"
        VIDEO = "video", "视频"
        AUDIO = "audio", "音频"

    class LabelSource(models.TextChoices):
        AUTO = "auto", "自动确认"
        REVIEW = "review", "人工复核"
        AI = "ai", "AI识别"

    class Status(models.TextChoices):
        READY = "ready", "就绪"
        EXPORTED = "exported", "已导出"
        INVALID = "invalid", "不可用"

    record = models.OneToOneField(
        MonitorRecord, on_delete=models.CASCADE, related_name="training_sample",
        verbose_name="监测记录",
    )
    asset = models.ForeignKey(
        "inference.MediaAsset", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="training_samples", verbose_name="媒体资产",
    )
    media_type = models.CharField(max_length=10, choices=MediaType.choices,
                                  default=MediaType.IMAGE, verbose_name="媒体类型")
    label = models.ForeignKey(
        Species, on_delete=models.SET_NULL, null=True, related_name="training_samples",
        verbose_name="训练标签物种",
    )
    label_source = models.CharField(max_length=10, choices=LabelSource.choices,
                                    default=LabelSource.AI, verbose_name="标签来源")
    confidence = models.FloatField(default=0, verbose_name="置信度")
    quality_flag = models.CharField(max_length=32, blank=True, verbose_name="质量标记")
    split = models.CharField(max_length=10, default="train", verbose_name="数据划分")
    model_version = models.CharField(max_length=30, blank=True, verbose_name="模型版本号")
    provider = models.CharField(max_length=20, blank=True, verbose_name="推理后端")
    tier = models.CharField(max_length=10, blank=True, verbose_name="执行层级")
    segmentation = models.JSONField(default=dict, blank=True, verbose_name="分割结果")
    audio_meta = models.JSONField(default=dict, blank=True, verbose_name="音频元数据")
    video_meta = models.JSONField(default=dict, blank=True, verbose_name="视频元数据")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.READY,
                              db_index=True, verbose_name="样本状态")
    exported_at = models.DateTimeField(null=True, blank=True, verbose_name="导出时间")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="登记时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        db_table = "training_sample"
        verbose_name = "训练样本"
        verbose_name_plural = verbose_name
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["media_type", "status"]),
            models.Index(fields=["label_source"]),
        ]
