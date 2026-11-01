from rest_framework import serializers

from .models import ClusterEvidence, EdnaEvidence, EvidenceCluster, FusionReviewLog


class EdnaEvidenceSerializer(serializers.ModelSerializer):
    speciesName = serializers.CharField(source="species.chinese_name", read_only=True)
    speciesLatinName = serializers.CharField(source="species.latin_name", read_only=True)
    surveyAreaName = serializers.CharField(source="survey_area.name", read_only=True)
    deviceName = serializers.CharField(source="device.name", read_only=True, default="")
    creatorName = serializers.CharField(source="created_by.username", read_only=True, default="")
    resultLabel = serializers.CharField(source="get_result_display", read_only=True)

    class Meta:
        model = EdnaEvidence
        fields = [
            "id", "species", "speciesName", "speciesLatinName", "survey_area", "surveyAreaName",
            "device", "deviceName", "sample_code", "sampled_at", "result", "resultLabel",
            "detection_confidence", "copy_number", "primer", "lat", "lng", "lab", "remark",
            "creatorName", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_detection_confidence(self, value):
        if not 0 <= value <= 1:
            raise serializers.ValidationError("检测置信度需在 0~1 之间")
        return value


class ClusterEvidenceSerializer(serializers.ModelSerializer):
    modalityLabel = serializers.CharField(source="get_modality_display", read_only=True)
    roleLabel = serializers.CharField(source="get_role_display", read_only=True)
    mediaUrl = serializers.SerializerMethodField()
    mediaType = serializers.SerializerMethodField()
    qualityFlag = serializers.SerializerMethodField()
    audioGrade = serializers.SerializerMethodField()
    ednaResult = serializers.SerializerMethodField()
    sampleCode = serializers.SerializerMethodField()

    class Meta:
        model = ClusterEvidence
        fields = [
            "id", "modality", "modalityLabel", "confidence", "reliability", "weight",
            "logit_value", "role", "roleLabel", "observed_at", "source_label",
            "mediaUrl", "mediaType", "qualityFlag", "audioGrade", "ednaResult", "sampleCode",
        ]

    def get_mediaUrl(self, obj):
        return obj.monitor_record.media_url if obj.monitor_record else ""

    def get_mediaType(self, obj):
        return obj.monitor_record.media_type if obj.monitor_record else ""

    def get_qualityFlag(self, obj):
        return obj.monitor_record.quality_flag if obj.monitor_record else ""

    def get_audioGrade(self, obj):
        return obj.monitor_record.audio_grade if obj.monitor_record else ""

    def get_ednaResult(self, obj):
        return obj.edna_evidence.result if obj.edna_evidence else ""

    def get_sampleCode(self, obj):
        return obj.edna_evidence.sample_code if obj.edna_evidence else ""


class FusionReviewLogSerializer(serializers.ModelSerializer):
    actionLabel = serializers.CharField(source="get_action_display", read_only=True)
    operatorName = serializers.CharField(source="operator.username", read_only=True, default="")

    class Meta:
        model = FusionReviewLog
        fields = ["id", "action", "actionLabel", "operatorName", "remark", "created_at"]


class EvidenceClusterListSerializer(serializers.ModelSerializer):
    speciesId = serializers.IntegerField(source="species.id", read_only=True)
    speciesName = serializers.CharField(source="species.chinese_name", read_only=True)
    speciesLatinName = serializers.CharField(source="species.latin_name", read_only=True)
    severityLevel = serializers.CharField(source="species.severity", read_only=True)
    surveyAreaId = serializers.IntegerField(source="survey_area.id", read_only=True)
    surveyAreaName = serializers.CharField(source="survey_area.name", read_only=True)
    deviceName = serializers.CharField(source="device.name", read_only=True, default="")
    reviewerName = serializers.CharField(source="reviewer.username", read_only=True, default="")
    fusedGradeLabel = serializers.CharField(source="get_fused_grade_display", read_only=True)
    statusLabel = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = EvidenceCluster
        fields = [
            "id", "speciesId", "speciesName", "speciesLatinName", "severityLevel",
            "surveyAreaId", "surveyAreaName", "deviceName",
            "window_start", "window_end", "status", "statusLabel",
            "fused_confidence", "fused_grade", "fusedGradeLabel",
            "evidence_count", "modality_count", "modalities",
            "has_image", "has_audio", "has_edna",
            "evidence_summary", "conflict_flag", "conflict_note",
            "reviewerName", "reviewed_at", "remark", "last_computed_at",
        ]


class EvidenceClusterDetailSerializer(EvidenceClusterListSerializer):
    evidences = ClusterEvidenceSerializer(many=True, read_only=True)
    reviewLogs = FusionReviewLogSerializer(source="review_logs", many=True, read_only=True)

    class Meta(EvidenceClusterListSerializer.Meta):
        fields = EvidenceClusterListSerializer.Meta.fields + ["evidences", "reviewLogs"]
