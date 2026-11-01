from rest_framework import serializers
from .models import SurveyArea


class SurveyAreaListSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurveyArea
        fields = [
            "id", "name", "type", "area", "elevation",
            "lat", "lng", "vegetation", "status",
            "device_count", "species_count", "last_survey",
        ]


class SurveyAreaDetailSerializer(SurveyAreaListSerializer):
    class Meta(SurveyAreaListSerializer.Meta):
        fields = SurveyAreaListSerializer.Meta.fields + ["created_at", "updated_at"]


class SurveyAreaWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurveyArea
        fields = [
            "name", "type", "area", "elevation",
            "lat", "lng", "vegetation", "status",
        ]
