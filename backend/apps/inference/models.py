"""识别任务编排数据模型：原始资产、异步任务、阈值变更留痕。"""
from django.conf import settings
from django.db import models

from apps.devices.models import Device
from apps.species.models import Species
from apps.survey_areas.models import SurveyArea


class MediaAsset(models.Model):
    """原始媒体资产：去重、质量过滤与追溯的最小单位。"""

    class SourceType(models.TextChoices):
        IMAGE = "image", "图像"
        VIDEO = "video", "视频"
        AUDIO = "audio", "音频"
        EDNA = "edna", "eDNA"

    class QualityStatus(models.TextChoices):
        OK = "ok", "正常"
        BLURRY = "blurry", "模糊"
        DARK = "dark", "过暗"
        OVEREXPOSED = "overexposed", "过曝"
        DUPLICATE = "duplicate", "重复"

    class ReliabilityGrade(models.TextChoices):
        RELIABLE = "reliable", "可靠"
        DEGRADED = "degraded", "降级"
        UNRELIABLE = "unreliable", "不可靠"

    file = models.FileField(upload_to="media_assets/%Y/%m/", verbose_name="原始文件")
    source_type = models.CharField(max_length=10, choices=SourceType.choices, verbose_name="数据类型")
    mime_type = models.CharField(max_length=100, blank=True, verbose_name="MIME类型")
    size = models.BigIntegerField(default=0, verbose_name="文件大小(字节)")
    sha256 = models.CharField(max_length=64, db_index=True, verbose_name="文件哈希")
    width = models.IntegerField(null=True, blank=True, verbose_name="宽")
    height = models.IntegerField(null=True, blank=True, verbose_name="高")
    duration = models.FloatField(null=True, blank=True, verbose_name="时长(秒)")
    quality_score = models.FloatField(null=True, blank=True, verbose_name="清晰度得分")
    quality_status = models.CharField(
        max_length=20, choices=QualityStatus.choices, default=QualityStatus.OK,
        verbose_name="质量状态",
    )
    # 声学质量指标（图像资产留空）
    snr_db = models.FloatField(null=True, blank=True, verbose_name="信噪比(dB)")
    vad_ratio = models.FloatField(null=True, blank=True, verbose_name="有效声段占比")
    overlap_ratio = models.FloatField(null=True, blank=True, verbose_name="声源重叠占比")
    separation_quality = models.FloatField(null=True, blank=True, verbose_name="声源分离质量")
    noise_ratio = models.FloatField(null=True, blank=True, verbose_name="噪声占比")
    reliability_score = models.FloatField(null=True, blank=True, verbose_name="声学可靠度")
    reliability_grade = models.CharField(
        max_length=12, choices=ReliabilityGrade.choices, blank=True,
        db_index=True, verbose_name="声学可靠度等级",
    )
    burst_group = models.CharField(max_length=64, blank=True, db_index=True, verbose_name="连拍组")
    is_rejected = models.BooleanField(default=False, verbose_name="是否废片(不送识别)")
    exif = models.JSONField(default=dict, blank=True, verbose_name="EXIF元数据")
    captured_at = models.DateTimeField(null=True, blank=True, verbose_name="拍摄/采集时间")

    device = models.ForeignKey(Device, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name="assets", verbose_name="设备")
    survey_area = models.ForeignKey(SurveyArea, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name="assets", verbose_name="样区")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name="uploaded_assets",
                                    verbose_name="上传人")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "media_asset"
        verbose_name = "媒体资产"
        verbose_name_plural = verbose_name
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["device", "-captured_at"])]

    def __str__(self):
        return f"{self.source_type}#{self.pk}"


class PredictionTask(models.Model):
    """识别任务状态机，承载异步、重试、降级与结果追溯。"""

    class Status(models.TextChoices):
        PENDING = "pending", "待处理"
        RUNNING = "running", "执行中"
        SUCCEEDED = "succeeded", "已完成"
        FAILED = "failed", "失败"
        SKIPPED = "skipped", "已跳过(废片/重复)"

    class TaskType(models.TextChoices):
        IMAGE = "image", "图像识别"
        AUDIO = "audio", "声学识别"

    class Tier(models.TextChoices):
        EDGE = "edge", "边缘轻量模型"
        CLOUD = "cloud", "云端大模型"

    class EscalationReason(models.TextChoices):
        LOW_CONFIDENCE = "low_confidence", "边缘置信度不足"
        PROTECTED_SPECIES = "protected_species", "保护物种强制上云"
        AMBIGUOUS = "ambiguous", "候选歧义"
        LOW_QUALITY = "low_quality", "质量异常"
        EDGE_ERROR = "edge_error", "边缘推理异常"
        FORCE_CLOUD = "force_cloud", "强制云端"
        BUDGET_EXHAUSTED = "budget_exhausted", "云端预算耗尽"

    class DecidedBy(models.TextChoices):
        EDGE = "edge", "边缘直判"
        CLOUD = "cloud", "云端判定"

    request_id = models.CharField(max_length=40, unique=True, verbose_name="请求ID")
    asset = models.ForeignKey(MediaAsset, on_delete=models.CASCADE,
                              related_name="tasks", verbose_name="媒体资产")
    task_type = models.CharField(max_length=10, choices=TaskType.choices, default=TaskType.IMAGE,
                                 verbose_name="任务类型")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING,
                              verbose_name="状态")
    provider = models.CharField(max_length=20, blank=True, verbose_name="推理后端")
    model_version = models.CharField(max_length=30, blank=True, verbose_name="模型版本号")
    model = models.ForeignKey("models_app.ModelVersion", on_delete=models.SET_NULL,
                              null=True, blank=True, related_name="tasks", verbose_name="模型")
    is_gray = models.BooleanField(default=False, verbose_name="是否灰度流量")
    # 两级调度：边缘端轻量模型先行，必要时上云
    tier = models.CharField(max_length=10, choices=Tier.choices, default=Tier.CLOUD,
                            db_index=True, verbose_name="当前执行层级")
    edge_provider = models.CharField(max_length=20, blank=True, verbose_name="边缘推理后端")
    edge_model_version = models.CharField(max_length=30, blank=True, verbose_name="边缘模型版本号")
    edge_confidence = models.FloatField(null=True, blank=True, verbose_name="边缘置信度")
    edge_latency_ms = models.IntegerField(null=True, blank=True, verbose_name="边缘耗时(毫秒)")
    edge_result = models.JSONField(default=dict, blank=True, verbose_name="边缘识别结果")
    escalated = models.BooleanField(default=False, db_index=True, verbose_name="是否上云")
    escalation_reason = models.CharField(max_length=30, blank=True, db_index=True,
                                         verbose_name="上云原因")
    cloud_confidence = models.FloatField(null=True, blank=True, verbose_name="云端置信度")
    decided_by = models.CharField(max_length=10, blank=True, verbose_name="最终判定层级")
    attempts = models.IntegerField(default=0, verbose_name="已尝试次数")
    max_attempts = models.IntegerField(default=3, verbose_name="最大尝试次数")
    error_code = models.CharField(max_length=50, blank=True, verbose_name="错误码")
    error_message = models.CharField(max_length=500, blank=True, verbose_name="错误信息")
    latency_ms = models.IntegerField(null=True, blank=True, verbose_name="耗时(毫秒)")
    result_payload = models.JSONField(default=dict, blank=True, verbose_name="识别结果")
    segmentation_result = models.JSONField(default=dict, blank=True, verbose_name="像素级分割结果")
    next_retry_at = models.DateTimeField(null=True, blank=True, verbose_name="下次重试时间")
    started_at = models.DateTimeField(null=True, blank=True, verbose_name="开始时间")
    finished_at = models.DateTimeField(null=True, blank=True, verbose_name="完成时间")
    record = models.ForeignKey("records.MonitorRecord", on_delete=models.SET_NULL,
                               null=True, blank=True, related_name="tasks",
                               verbose_name="生成的监测记录")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "prediction_task"
        verbose_name = "识别任务"
        verbose_name_plural = verbose_name
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "next_retry_at"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self):
        return f"{self.request_id} ({self.status})"


class ThresholdAudit(models.Model):
    """物种复核阈值变更留痕（可追溯谁在何时改了什么）。"""

    species = models.ForeignKey(Species, on_delete=models.CASCADE,
                                related_name="threshold_audits", verbose_name="物种")
    old_value = models.FloatField(null=True, blank=True, verbose_name="变更前")
    new_value = models.FloatField(null=True, blank=True, verbose_name="变更后")
    operator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                 null=True, blank=True, related_name="threshold_audits",
                                 verbose_name="操作人")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="操作时间")

    class Meta:
        db_table = "threshold_audit"
        verbose_name = "阈值变更记录"
        verbose_name_plural = verbose_name
        ordering = ["-created_at"]
