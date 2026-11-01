from rest_framework import serializers
from .models import Alert


class AlertListSerializer(serializers.ModelSerializer):
    surveyAreaId = serializers.IntegerField(source="survey_area.id", default=None)
    surveyAreaName = serializers.CharField(source="survey_area.name", default="")

    class Meta:
        model = Alert
        fields = [
            "id", "type", "level", "title", "description",
            "surveyAreaId", "surveyAreaName", "source", "source_ref",
            "is_read", "created_at",
        ]


class AlertDetailSerializer(AlertListSerializer):
    pass


class AlertWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = ["type", "level", "title", "description", "survey_area"]
