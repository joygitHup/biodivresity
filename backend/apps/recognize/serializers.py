from rest_framework import serializers
from .models import RecognizeRecord


class RecognizeRequestSerializer(serializers.Serializer):
    image = serializers.ImageField(help_text="待识别图像文件 (JPG/PNG/WebP, ≤10MB)")
    crop_id = serializers.CharField(required=False, allow_blank=True, help_text="限定作物类别ID(可选)")


class Top5ItemSerializer(serializers.Serializer):
    category_id = serializers.CharField()
    name = serializers.CharField()
    path = serializers.CharField()
    confidence = serializers.FloatField()


class RecognizeResponseSerializer(serializers.Serializer):
    request_id = serializers.CharField()
    model_version = serializers.CharField()
    top_k = Top5ItemSerializer(many=True)
    rejected = serializers.BooleanField()
    advisory = serializers.DictField(child=serializers.CharField())
    disclaimer = serializers.CharField()


class RecognizeRecordListSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecognizeRecord
        fields = [
            "id", "image_url", "top_category_name", "top_confidence",
            "rejected", "model_version", "created_at",
        ]


class RecognizeRecordDetailSerializer(RecognizeRecordListSerializer):
    class Meta(RecognizeRecordListSerializer.Meta):
        fields = RecognizeRecordListSerializer.Meta.fields + [
            "top_category_id", "top5_result", "request_id", "disclaimer",
        ]
