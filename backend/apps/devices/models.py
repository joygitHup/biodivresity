import hashlib
import secrets

from django.db import models
from apps.survey_areas.models import SurveyArea


class DeviceQuerySet(models.QuerySet):
    def online(self):
        return self.filter(status="online")

    def by_area(self, area_id):
        return self.filter(survey_area_id=area_id)


class Device(models.Model):
    class Type(models.TextChoices):
        INFRARED_CAMERA = "infrared_camera", "红外相机"
        AUDIO_RECORDER = "audio_recorder", "鸣声记录仪"
        RADAR_CAMERA = "radar_camera", "雷达相机"
        BUTTERFLY_TRAP = "butterfly_trap", "蝴蝶监测仪"
        EDNA = "edna", "eDNA采集装置"
        HD_CAMERA = "hd_camera", "高清相机"

    class Status(models.TextChoices):
        ONLINE = "online", "在线"
        OFFLINE = "offline", "离线"
        WARNING = "warning", "告警"

    name = models.CharField(max_length=100, verbose_name="设备名称")
    type = models.CharField(max_length=30, choices=Type.choices, verbose_name="设备类型")
    location = models.CharField(max_length=200, blank=True, verbose_name="安装位置")
    lat = models.FloatField(null=True, blank=True, verbose_name="纬度")
    lng = models.FloatField(null=True, blank=True, verbose_name="经度")
    survey_area = models.ForeignKey(SurveyArea, on_delete=models.SET_NULL, null=True, related_name="devices", verbose_name="所属样区")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ONLINE, verbose_name="状态")
    battery = models.IntegerField(default=100, verbose_name="电量(%)")
    storage = models.IntegerField(default=0, verbose_name="存储使用率(%)")
    signal = models.IntegerField(default=0, verbose_name="信号强度(%)")
    edge_enabled = models.BooleanField(
        default=False, verbose_name="边缘推理能力",
        help_text="开启后该设备采集的数据先由边缘轻量模型判定，必要时再上云",
    )
    edge_model = models.CharField(
        max_length=60, blank=True, verbose_name="边缘模型版本号",
        help_text="部署在该设备/网关上的轻量模型版本，如 edge-yolov8n-v1.2",
    )
    edge_framework = models.CharField(
        max_length=30, blank=True, verbose_name="边缘推理框架",
        help_text="onnxruntime / tflite / ncnn / tensorrt / openvino / other",
    )
    edge_capability = models.CharField(
        max_length=100, blank=True, verbose_name="边缘算力描述",
        help_text="如：4 TOPS、NPU算力、CPU四核等，用于评估可承载的模型规模",
    )
    edge_token_hash = models.CharField(
        max_length=128, blank=True, verbose_name="边缘设备Token哈希",
        help_text="设备上报识别结果时的鉴权Token（仅存SHA256哈希）",
    )
    edge_token_created_at = models.DateTimeField(
        null=True, blank=True, verbose_name="边缘Token创建时间",
    )
    last_data_time = models.DateTimeField(null=True, blank=True, verbose_name="最后数据时间")
    install_date = models.DateField(null=True, blank=True, verbose_name="安装日期")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = DeviceQuerySet.as_manager()

    class Meta:
        db_table = "device"
        verbose_name = "监测设备"
        verbose_name_plural = verbose_name
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "type"]),
        ]

    def __str__(self):
        return self.name

    # ── 设备级 Token 管理 ────────────────────────────────────

    def generate_edge_token(self) -> str:
        """生成边缘设备 Token，返回明文（仅一次），同时存储 SHA256 哈希。"""
        from django.utils import timezone

        token = secrets.token_urlsafe(32)
        self.edge_token_hash = hashlib.sha256(token.encode()).hexdigest()
        self.edge_token_created_at = timezone.now()
        self.save(update_fields=["edge_token_hash", "edge_token_created_at", "updated_at"])
        return token

    def verify_edge_token(self, token: str) -> bool:
        """校验设备上报时携带的 Token。"""
        if not token or not self.edge_token_hash:
            return False
        return hashlib.sha256(token.encode()).hexdigest() == self.edge_token_hash

    def clear_edge_token(self) -> None:
        """吊销设备 Token。"""
        self.edge_token_hash = ""
        self.edge_token_created_at = None
        self.save(update_fields=["edge_token_hash", "edge_token_created_at", "updated_at"])
