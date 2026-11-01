from django.db import models
from django.conf import settings
from apps.recognize.models import RecognizeRecord


class Feedback(models.Model):
    """用户对识别结果的反馈."""

    class Correctness(models.TextChoices):
        CORRECT = "correct", "识别正确"
        WRONG = "wrong", "识别错误"

    class ReviewStatus(models.TextChoices):
        PENDING = "pending", "待复核"
        REVIEWED = "reviewed", "已复核"
        USED = "used", "已用于训练"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="feedbacks")
    recognize_record = models.ForeignKey(RecognizeRecord, on_delete=models.CASCADE, related_name="feedbacks")
    correctness = models.CharField(max_length=20, choices=Correctness.choices, verbose_name="是否正确")
    suggested_category_id = models.CharField(max_length=50, blank=True, verbose_name="建议类别ID")
    suggested_category_name = models.CharField(max_length=200, blank=True, verbose_name="建议类别名")
    comment = models.TextField(blank=True, verbose_name="用户备注")
    review_status = models.CharField(max_length=20, choices=ReviewStatus.choices, default=ReviewStatus.PENDING, verbose_name="复核状态")
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_feedbacks")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "feedback"
        verbose_name = "识别反馈"
        verbose_name_plural = verbose_name
        ordering = ["-created_at"]
