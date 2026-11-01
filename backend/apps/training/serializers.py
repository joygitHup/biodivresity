from rest_framework import serializers

from .models import TrainingReport, TrainingRun
from .services import REPORT_STATUS_LABELS, serialize_report


class TrainingRunListSerializer(serializers.ModelSerializer):
    mediaLabel = serializers.SerializerMethodField()
    snapshotCount = serializers.SerializerMethodField()
    classCount = serializers.SerializerMethodField()
    trainCount = serializers.SerializerMethodField()
    valCount = serializers.SerializerMethodField()
    testCount = serializers.SerializerMethodField()
    snapshotHash = serializers.SerializerMethodField()
    submittedBy = serializers.SerializerMethodField()
    reportId = serializers.SerializerMethodField()
    reportStatus = serializers.SerializerMethodField()
    reportStatusLabel = serializers.SerializerMethodField()
    reportRevision = serializers.SerializerMethodField()
    gatePassed = serializers.SerializerMethodField()
    metricsSummary = serializers.SerializerMethodField()
    modelVersionId = serializers.SerializerMethodField()

    class Meta:
        model = TrainingRun
        fields = [
            "id", "media_type", "mediaLabel", "model_family", "status",
            "snapshotCount", "classCount", "trainCount", "valCount", "testCount",
            "snapshotHash", "submittedBy", "reportId", "reportStatus",
            "reportStatusLabel", "reportRevision", "gatePassed", "metricsSummary",
            "modelVersionId", "report_ready", "retry_count", "error_message",
            "started_at", "finished_at", "created_at",
        ]

    def _snapshot(self, obj):
        return obj.snapshot

    def get_mediaLabel(self, obj):
        return dict(TrainingRun.MediaType.choices).get(obj.media_type, obj.media_type)

    def get_snapshotCount(self, obj):
        return obj.snapshot.sample_count if obj.snapshot else 0

    def get_classCount(self, obj):
        return obj.snapshot.class_count if obj.snapshot else 0

    def get_trainCount(self, obj):
        return obj.snapshot.train_count if obj.snapshot else 0

    def get_valCount(self, obj):
        return obj.snapshot.val_count if obj.snapshot else 0

    def get_testCount(self, obj):
        return obj.snapshot.test_count if obj.snapshot else 0

    def get_snapshotHash(self, obj):
        return obj.snapshot.sample_hash if obj.snapshot else ""

    def get_submittedBy(self, obj):
        return obj.submitted_by.username if obj.submitted_by else ""

    def _report(self, obj):
        return obj.latest_report

    def get_reportId(self, obj):
        report = self._report(obj)
        return report.id if report else None

    def get_reportStatus(self, obj):
        report = self._report(obj)
        return report.status if report else ""

    def get_reportStatusLabel(self, obj):
        report = self._report(obj)
        return REPORT_STATUS_LABELS.get(report.status, report.status) if report else ""

    def get_reportRevision(self, obj):
        report = self._report(obj)
        return report.revision if report else 0

    def get_gatePassed(self, obj):
        report = self._report(obj)
        return bool((report.quality_gate or {}).get("passed")) if report else False

    def get_metricsSummary(self, obj):
        metrics = obj.metrics or {}
        return {
            "top1": metrics.get("top1_accuracy"),
            "map50": metrics.get("map50"),
            "protectedRecall": metrics.get("protected_recall"),
            "falsePositiveRate": metrics.get("false_positive_rate"),
        }

    def get_modelVersionId(self, obj):
        return obj.target_model_version_id


class TrainingRunDetailSerializer(TrainingRunListSerializer):
    latestReport = serializers.SerializerMethodField()
    hyperparams = serializers.JSONField()
    filters = serializers.JSONField()
    metrics = serializers.JSONField()
    artifact = serializers.CharField()

    class Meta(TrainingRunListSerializer.Meta):
        fields = TrainingRunListSerializer.Meta.fields + [
            "filters", "hyperparams", "metrics", "artifact", "latestReport",
        ]

    def get_latestReport(self, obj):
        report = obj.latest_report
        if report is None:
            return None
        request = self.context.get("request")
        return serialize_report(report, getattr(request, "user", None))


class TrainingReportSerializer(serializers.ModelSerializer):
    runId = serializers.IntegerField(source="run.id", read_only=True)
    statusLabel = serializers.SerializerMethodField()
    hasHtml = serializers.SerializerMethodField()
    hasPdf = serializers.SerializerMethodField()
    submittedBy = serializers.SerializerMethodField()
    reviewedBy = serializers.SerializerMethodField()
    approvedBy = serializers.SerializerMethodField()
    metrics = serializers.JSONField()
    comparison = serializers.JSONField()
    qualityGate = serializers.JSONField(source="quality_gate")
    conclusion = serializers.CharField(allow_blank=True)
    submittedById = serializers.IntegerField(source="submitted_by_id", read_only=True)
    generatedAt = serializers.DateTimeField(source="generated_at")
    submittedAt = serializers.DateTimeField(source="submitted_at")
    reviewedAt = serializers.DateTimeField(source="reviewed_at")
    approvedAt = serializers.DateTimeField(source="approved_at")
    reviewComment = serializers.CharField(source="review_comment")
    approvalComment = serializers.CharField(source="approval_comment")
    canSubmit = serializers.SerializerMethodField()
    canReview = serializers.SerializerMethodField()
    canApprove = serializers.SerializerMethodField()
    canReject = serializers.SerializerMethodField()
    isSubmitter = serializers.SerializerMethodField()

    class Meta:
        model = TrainingReport
        fields = [
            "id", "runId", "revision", "status", "statusLabel", "approval_level",
            "metrics", "comparison", "qualityGate", "conclusion",
            "hasHtml", "hasPdf", "generatedAt", "submittedAt", "submittedBy",
            "submittedById", "reviewedBy", "reviewedAt", "reviewComment",
            "approvedBy", "approvedAt", "approvalComment", "created_at",
            "canSubmit", "canReview", "canApprove", "canReject", "isSubmitter",
        ]

    def _flags(self, obj):
        request = self.context.get("request")
        return serialize_report(obj, getattr(request, "user", None))

    def get_canSubmit(self, obj):
        return self._flags(obj)["canSubmit"]

    def get_canReview(self, obj):
        return self._flags(obj)["canReview"]

    def get_canApprove(self, obj):
        return self._flags(obj)["canApprove"]

    def get_canReject(self, obj):
        return self._flags(obj)["canReject"]

    def get_isSubmitter(self, obj):
        return self._flags(obj)["isSubmitter"]

    def get_statusLabel(self, obj):
        return REPORT_STATUS_LABELS.get(obj.status, obj.status)

    def get_hasHtml(self, obj):
        return bool(obj.html_path)

    def get_hasPdf(self, obj):
        return bool(obj.pdf_path)

    def get_submittedBy(self, obj):
        return obj.submitted_by.username if obj.submitted_by else ""

    def get_reviewedBy(self, obj):
        return obj.reviewed_by.username if obj.reviewed_by else ""

    def get_approvedBy(self, obj):
        return obj.approved_by.username if obj.approved_by else ""


class TrainingRunCreateSerializer(serializers.Serializer):
    media_type = serializers.ChoiceField(choices=TrainingRun.MediaType.choices, default="image")
    model_family = serializers.CharField(required=False, allow_blank=True, default="")
    epochs = serializers.IntegerField(required=False, min_value=1, max_value=500, default=30)
    batch_size = serializers.IntegerField(required=False, min_value=1, max_value=512, default=16)
    learning_rate = serializers.FloatField(required=False, default=0.001)
    label_sources = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    min_confidence = serializers.FloatField(required=False, min_value=0, max_value=1, default=0)
    exclude_quality = serializers.BooleanField(required=False, default=False)
