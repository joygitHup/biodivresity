from rest_framework import serializers
from .models import Device


class DeviceListSerializer(serializers.ModelSerializer):
    surveyAreaName = serializers.CharField(source="survey_area.name", default="")
    surveyAreaId = serializers.IntegerField(source="survey_area.id", default=None)
    has_edge_token = serializers.SerializerMethodField()

    class Meta:
        model = Device
        fields = [
            "id", "name", "type", "location", "lat", "lng",
            "surveyAreaId", "surveyAreaName",
            "status", "battery", "storage", "signal", "edge_enabled",
            "edge_model", "edge_framework", "edge_capability",
            "has_edge_token", "edge_token_created_at",
            "last_data_time", "install_date",
        ]

    def get_has_edge_token(self, obj) -> bool:
        return bool(obj.edge_token_hash)


class DeviceDetailSerializer(DeviceListSerializer):
    class Meta(DeviceListSerializer.Meta):
        fields = DeviceListSerializer.Meta.fields + ["created_at", "updated_at"]


class DeviceWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = [
            "name", "type", "location", "lat", "lng", "survey_area",
            "status", "battery", "storage", "signal", "edge_enabled",
            "edge_model", "edge_framework", "edge_capability",
            "last_data_time", "install_date",
        ]

    def validate(self, attrs):
        # 电量/存储/信号均为百分比，限制 0-100
        for field in ("battery", "storage", "signal"):
            value = attrs.get(field)
            if value is not None and not (0 <= value <= 100):
                raise serializers.ValidationError({field: "必须是 0-100 之间的数值"})
        return attrs
