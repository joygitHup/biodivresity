"""跨模态证据融合数据模型：证据簇、证据明细、eDNA 检测与复核留痕。"""
from django.conf import settings
from django.db import models

from apps.devices.models import Device
from apps.species.models import Species
from apps.survey_areas.models import SurveyArea


class EdnaEvidence(models.Model):
    """eDNA 采样检测结果，作为独立于图像/声学的证据来源。"""

    class Result(models.TextChoices):
        POSITIVE = "positive", "阳性"
        NEGATIVE = "negative", "阴性"

    species = models.ForeignKey(Species, on_delete=models.CASCADE,
                                related_name="edna_evidences", verbose_name="物种")
    survey_area = models.ForeignKey(SurveyArea, on_delete=models.CASCADE,
                                    related_name="edna_evidences", verbose_name="样区")
    device = models.ForeignKey(Device, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name="edna_evidences", verbose_name="采样设备")
    sample_code = models.CharField(max_length=64, blank=True, verbose_name="样本编号")
    sampled_at = models.DateTimeField(verbose_name="采样时间")
    result = models.CharField(max_length=10, choices=Result.choices,
                              default=Result.POSITIVE, verbose_name="检测结果")
    detection_confidence = models.FloatField(default=0.8, verbose_name="检测置信度")
    copy_number = models.FloatField(null=True, blank=True, verbose_name="环境DNA浓度(copies/L)")
    primer = models.CharField(max_length=100, blank=True, verbose_name="引物/探针")
    lat = models.FloatField(null=True, blank=True, verbose_name="纬度")
    lng = models.FloatField(null=True, blank=True, verbose_name="经度")
    lab = models.CharField(max_length=100, blank=True, verbose_name="检测实验室")
    remark = models.TextField(blank=True, verbose_name="备注")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name="edna_evidences",
                                   verbose_name="录入人")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "edna_evidence"
        verbose_name = "eDNA检测证据"
        verbose_name_plural = verbose_name
        ordering = ["-sampled_at"]
        indexes = [
            models.Index(fields=["species", "survey_area", "-sampled_at"]),
        ]

    def __str__(self):
        return f"{self.species_id}@{self.sampled_at:%Y-%m-%d} ({self.result})"


class EvidenceCluster(models.Model):
    """同一物种 × 监测样区 × 时间窗内的跨模态证据簇。"""

    class Status(models.TextChoices):
        PENDING = "pending", "待复核"
        CONFIRMED = "confirmed", "已确认"
        REJECTED = "rejected", "已驳回"

    class Grade(models.TextChoices):
        STRONG = "strong", "强证据"
        MODERATE = "moderate", "中等证据"
        WEAK = "weak", "弱证据"
        CONFLICT = "conflict", "证据冲突"
        INSUFFICIENT = "insufficient", "模态不足"

    species = models.ForeignKey(Species, on_delete=models.CASCADE,
                                related_name="fusion_clusters", verbose_name="物种")
    survey_area = models.ForeignKey(SurveyArea, on_delete=models.CASCADE,
                                    related_name="fusion_clusters", verbose_name="样区")
    device = models.ForeignKey(Device, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name="fusion_clusters", verbose_name="代表设备")
    window_start = models.DateTimeField(verbose_name="时间窗开始")
    window_end = models.DateTimeField(verbose_name="时间窗结束")
    status = models.CharField(max_length=12, choices=Status.choices,
                              default=Status.PENDING, verbose_name="复核状态")
    fused_confidence = models.FloatField(default=0, verbose_name="融合置信度")
    fused_grade = models.CharField(max_length=12, choices=Grade.choices,
                                   default=Grade.INSUFFICIENT, verbose_name="融合等级")
    evidence_count = models.IntegerField(default=0, verbose_name="证据条数")
    modality_count = models.IntegerField(default=0, verbose_name="模态数量")
    modalities = models.JSONField(default=list, blank=True, verbose_name="涉及模态")
    has_image = models.BooleanField(default=False, verbose_name="含图像证据")
    has_audio = models.BooleanField(default=False, verbose_name="含声学证据")
    has_edna = models.BooleanField(default=False, verbose_name="含eDNA证据")
    evidence_summary = models.JSONField(default=dict, blank=True, verbose_name="证据摘要")
    conflict_flag = models.BooleanField(default=False, verbose_name="是否冲突")
    conflict_note = models.CharField(max_length=200, blank=True, verbose_name="冲突说明")
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                 null=True, blank=True, related_name="fusion_clusters",
                                 verbose_name="复核人")
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name="复核时间")
    remark = models.TextField(blank=True, verbose_name="复核备注")
    last_computed_at = models.DateTimeField(null=True, blank=True, verbose_name="最近计算时间")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "evidence_cluster"
        verbose_name = "跨模态证据簇"
        verbose_name_plural = verbose_name
        ordering = ["-window_start", "-fused_confidence"]
        unique_together = [("species", "survey_area", "window_start")]
        indexes = [
            models.Index(fields=["status", "-window_start"]),
            models.Index(fields=["survey_area", "-window_start"]),
        ]

    def __str__(self):
        return f"{self.species_id}@{self.window_start:%Y-%m-%d %H:%M}"


class ClusterEvidence(models.Model):
    """证据簇内的单条证据快照，保留融合时的权重与贡献，便于追溯。"""

    class Modality(models.TextChoices):
        IMAGE = "image", "图像/视频"
        AUDIO = "audio", "声学"
        EDNA = "edna", "eDNA"

    class Role(models.TextChoices):
        SUPPORT = "support", "支持"
        NEGATIVE = "negative", "反对"

    cluster = models.ForeignKey(EvidenceCluster, on_delete=models.CASCADE,
                                related_name="evidences", verbose_name="证据簇")
    modality = models.CharField(max_length=10, choices=Modality.choices, verbose_name="模态")
    monitor_record = models.ForeignKey("records.MonitorRecord", on_delete=models.SET_NULL,
                                       null=True, blank=True, related_name="fusion_evidences",
                                       verbose_name="监测记录")
    edna_evidence = models.ForeignKey(EdnaEvidence, on_delete=models.SET_NULL,
                                      null=True, blank=True, related_name="fusion_evidences",
                                      verbose_name="eDNA证据")
    confidence = models.FloatField(default=0, verbose_name="原始置信度")
    reliability = models.FloatField(default=1, verbose_name="可靠性系数")
    weight = models.FloatField(default=0, verbose_name="融合权重")
    logit_value = models.FloatField(default=0, verbose_name="加权logit贡献")
    role = models.CharField(max_length=10, choices=Role.choices,
                            default=Role.SUPPORT, verbose_name="证据方向")
    observed_at = models.DateTimeField(verbose_name="观测时间")
    source_label = models.CharField(max_length=120, blank=True, verbose_name="来源说明")

    class Meta:
        db_table = "cluster_evidence"
        verbose_name = "证据明细"
        verbose_name_plural = verbose_name
        ordering = ["modality", "-observed_at"]
        indexes = [models.Index(fields=["cluster", "modality"])]


class FusionReviewLog(models.Model):
    """证据簇复核留痕：记录操作人、动作、备注与时间。"""

    cluster = models.ForeignKey(EvidenceCluster, on_delete=models.CASCADE,
                                related_name="review_logs", verbose_name="证据簇")
    action = models.CharField(max_length=12, choices=EvidenceCluster.Status.choices,
                              verbose_name="复核动作")
    operator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                 null=True, blank=True, related_name="fusion_review_logs",
                                 verbose_name="操作人")
    remark = models.TextField(blank=True, verbose_name="备注")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="操作时间")

    class Meta:
        db_table = "fusion_review_log"
        verbose_name = "证据融合复核记录"
        verbose_name_plural = verbose_name
        ordering = ["-created_at"]
