from rest_framework import serializers
from .models import MonitorRecord, TrainingSample


class MonitorRecordListSerializer(serializers.ModelSerializer):
    deviceId = serializers.IntegerField(source="device.id", default=None)
    deviceName = serializers.CharField(source="device.name", default="")
    surveyAreaId = serializers.IntegerField(source="survey_area.id", default=None)
    surveyAreaName = serializers.CharField(source="survey_area.name", default="")
    speciesId = serializers.IntegerField(source="species.id", default=None)
    speciesName = serializers.CharField(source="species.chinese_name", default="")
    speciesLatinName = serializers.CharField(source="species.latin_name", default="")
    severityLevel = serializers.CharField(source="species.severity", default="")
    reviewThreshold = serializers.SerializerMethodField()
    correctedSpeciesId = serializers.IntegerField(source="corrected_species.id", default=None)
    correctedSpeciesName = serializers.CharField(source="corrected_species.chinese_name", default="")
    reviewerName = serializers.CharField(source="reviewed_by.username", default="")
    assetId = serializers.IntegerField(source="asset.id", default=None)

    class Meta:
        model = MonitorRecord
        fields = [
            "id", "deviceId", "deviceName", "timestamp",
            "lat", "lng", "surveyAreaId", "surveyAreaName",
            "speciesId", "speciesName", "speciesLatinName", "severityLevel",
            "count", "behavior", "confidence", "review_status",
            "media_url", "media_type", "quality_flag",
            "audio_reliability", "audio_grade", "assetId",
            "reviewThreshold", "correctedSpeciesId", "correctedSpeciesName",
            "reviewerName", "reviewed_at",
        ]

    def get_reviewThreshold(self, obj):
        from .services import effective_threshold
        return effective_threshold(obj)


class MonitorRecordDetailSerializer(MonitorRecordListSerializer):
    class Meta(MonitorRecordListSerializer.Meta):
        fields = MonitorRecordListSerializer.Meta.fields + ["remark", "created_at"]


class MonitorRecordWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = MonitorRecord
        fields = [
            "device", "survey_area", "species", "timestamp",
            "lat", "lng", "count", "behavior", "confidence",
            "review_status", "media_url", "media_type", "remark",
        ]


class TrainingSampleSerializer(serializers.ModelSerializer):
    recordId = serializers.IntegerField(source="record.id", default=None)
    assetId = serializers.IntegerField(source="asset.id", default=None)
    mediaUrl = serializers.CharField(source="record.media_url", default="")
    labelName = serializers.CharField(source="label.chinese_name", default="")
    labelLatinName = serializers.CharField(source="label.latin_name", default="")
    labelId = serializers.IntegerField(source="label.id", default=None)
    severityLevel = serializers.CharField(source="label.severity", default="")
    deviceName = serializers.CharField(source="record.device.name", default="")
    surveyAreaName = serializers.CharField(source="record.survey_area.name", default="")
    capturedAt = serializers.DateTimeField(source="record.timestamp", default=None)

    class Meta:
        model = TrainingSample
        # 大 JSON 字段（audio_meta/video_meta/segmentation）不进列表，避免拖慢分页
        fields = [
            "id", "recordId", "assetId", "mediaUrl", "media_type", "labelId",
            "labelName", "labelLatinName", "severityLevel", "label_source",
            "confidence", "quality_flag", "split", "model_version", "provider", "tier",
            "status", "deviceName", "surveyAreaName", "capturedAt",
            "exported_at", "created_at",
        ]
