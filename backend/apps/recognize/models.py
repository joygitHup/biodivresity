from django.db import models
from django.conf import settings


class RecognizeRecord(models.Model):
    """病虫害识别记录."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="recognize_records")
    image = models.ImageField(upload_to="recognize/", verbose_name="上传图像")
    image_url = models.URLField(blank=True, verbose_name="图像URL(冗余)")
    top_category_id = models.CharField(max_length=50, verbose_name="Top-1 类别ID")
    top_category_name = models.CharField(max_length=200, verbose_name="Top-1 类别名")
    top_confidence = models.FloatField(verbose_name="Top-1 置信度")
    top5_result = models.JSONField(default=list, verbose_name="Top-5 结果")
    rejected = models.BooleanField(default=False, verbose_name="是否拒识")
    model_version = models.CharField(max_length=50, default="v1.0.0", verbose_name="模型版本")
    request_id = models.CharField(max_length=50, blank=True, verbose_name="请求ID")
    disclaimer = models.CharField(
        max_length=500,
        default="识别结果仅供参考，重大病虫害请以农技部门诊断为准",
        verbose_name="免责声明",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "recognize_record"
        verbose_name = "识别记录"
        verbose_name_plural = verbose_name
        ordering = ["-created_at"]
