from rest_framework import serializers

from .models import MediaAsset, PredictionTask, ThresholdAudit


class MediaAssetSerializer(serializers.ModelSerializer):
    deviceName = serializers.CharField(source="device.name", default="")
    surveyAreaName = serializers.CharField(source="survey_area.name", default="")
    uploadedByName = serializers.CharField(source="uploaded_by.username", default="")
    fileUrl = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = [
            "id", "fileUrl", "source_type", "mime_type", "size", "sha256",
            "width", "height", "duration", "quality_score", "quality_status",
            "snr_db", "vad_ratio", "overlap_ratio", "separation_quality", "noise_ratio",
            "reliability_score", "reliability_grade",
            "burst_group", "is_rejected", "captured_at",
            "device", "deviceName", "survey_area", "surveyAreaName",
            "uploaded_by", "uploadedByName", "created_at",
        ]

    def get_fileUrl(self, obj):
        return obj.file.url if obj.file else ""


class MediaAssetBriefSerializer(serializers.ModelSerializer):
    fileUrl = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = ["id", "fileUrl", "source_type", "sha256", "quality_status",
                  "reliability_grade", "device", "survey_area"]

    def get_fileUrl(self, obj):
        return obj.file.url if obj.file else ""


class PredictionTaskListSerializer(serializers.ModelSerializer):
    asset = MediaAssetBriefSerializer(read_only=True)
    deviceName = serializers.CharField(source="asset.device.name", default="")
    surveyAreaName = serializers.CharField(source="asset.survey_area.name", default="")

    class Meta:
        model = PredictionTask
        fields = [
            "id", "request_id", "task_type", "status", "provider",
            "model", "model_version", "is_gray", "attempts", "max_attempts",
            "tier", "edge_provider", "edge_model_version", "edge_confidence",
            "edge_latency_ms", "escalated", "escalation_reason",
            "cloud_confidence", "decided_by",
            "error_code", "error_message", "latency_ms", "next_retry_at",
            "record", "asset", "deviceName", "surveyAreaName",
            "started_at", "finished_at", "created_at",
        ]


class PredictionTaskDetailSerializer(PredictionTaskListSerializer):
    class Meta(PredictionTaskListSerializer.Meta):
        fields = PredictionTaskListSerializer.Meta.fields + ["result_payload", "edge_result", "segmentation_result"]


class ThresholdAuditSerializer(serializers.ModelSerializer):
    speciesName = serializers.CharField(source="species.chinese_name", default="")
    protectionLevel = serializers.CharField(source="species.protection_level", default="")
    operatorName = serializers.CharField(source="operator.username", default="")

    class Meta:
        model = ThresholdAudit
        fields = [
            "id", "species", "speciesName", "protectionLevel",
            "old_value", "new_value", "operator", "operatorName", "created_at",
        ]


class IngestOptionsSerializer(serializers.Serializer):
    """文件之外的可选参数，device / survey_area 由视图解析成对象。"""

    source_type = serializers.ChoiceField(
        choices=MediaAsset.SourceType.choices, required=False,
    )
    device = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    survey_area = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    captured_at = serializers.DateTimeField(required=False, allow_null=True)
    quality_score = serializers.FloatField(required=False, allow_null=True,
                                           min_value=0, max_value=1)
    burst_group = serializers.CharField(required=False, allow_blank=True, max_length=64)


class EdgeReportSerializer(serializers.Serializer):
    """边缘网关上报的轻量模型结果。"""

    asset_id = serializers.IntegerField(min_value=1)
    top_k = serializers.ListField(child=serializers.DictField(), allow_empty=False)
    model_version = serializers.CharField(required=False, allow_blank=True, default="")
    latency_ms = serializers.IntegerField(required=False, min_value=0, default=0)
    provider = serializers.CharField(required=False, allow_blank=True, default="edge")
    quality_flag = serializers.CharField(required=False, allow_blank=True, default="")
    noise_ratio = serializers.FloatField(required=False, default=0.0)
    separation_quality = serializers.FloatField(required=False, allow_null=True, default=None)

    def validate_top_k(self, value):
        for item in value:
            if not item.get("species_id") and not item.get("category_id"):
                raise serializers.ValidationError("每个候选必须包含 species_id")
            try:
                confidence = float(item.get("confidence", 0))
            except (TypeError, ValueError):
                raise serializers.ValidationError("confidence 必须为数值")
            if not 0 <= confidence <= 1:
                raise serializers.ValidationError("confidence 必须在 0-1 之间")
        return value
