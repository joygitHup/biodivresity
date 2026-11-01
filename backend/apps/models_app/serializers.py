from rest_framework import serializers
from .models import ModelVersion


class ModelVersionListSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModelVersion
        fields = [
            "id", "version", "name", "input_size",
            "top1_accuracy", "top5_accuracy", "status",
            "inference_count", "avg_confidence", "reject_rate",
            "is_active", "task_type", "deploy_scope", "traffic_ratio", "tier",
            "training_run", "training_report", "approval_status", "approved_at",
            "created_at",
        ]


class ModelVersionDetailSerializer(ModelVersionListSerializer):
    class Meta(ModelVersionListSerializer.Meta):
        fields = ModelVersionListSerializer.Meta.fields + [
            "file_path", "file_hash", "description", "updated_at",
            "approved_by",
        ]


class ModelVersionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModelVersion
        fields = [
            "version", "name", "file_path", "file_hash",
            "input_size", "top1_accuracy", "top5_accuracy",
            "status", "description", "task_type", "deploy_scope", "traffic_ratio", "tier",
        ]
