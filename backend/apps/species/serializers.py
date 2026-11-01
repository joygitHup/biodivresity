from rest_framework import serializers
from .models import Species


class SpeciesListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Species
        fields = [
            "id", "chinese_name", "latin_name", "crop", "damage_type", "part",
            "severity", "image_url", "record_count", "review_threshold",
        ]


class SpeciesDetailSerializer(SpeciesListSerializer):
    class Meta(SpeciesListSerializer.Meta):
        fields = [
            "id", "chinese_name", "latin_name", "crop", "damage_type", "part",
            "severity", "symptoms", "prevention",
            "description", "distribution", "image_url", "record_count",
            "review_threshold", "created_at", "updated_at",
        ]


class SpeciesWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Species
        fields = [
            "chinese_name", "latin_name", "crop", "damage_type", "part",
            "severity", "symptoms", "prevention",
            "description", "distribution", "image_url", "review_threshold",
        ]
