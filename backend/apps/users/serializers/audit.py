from rest_framework import serializers
from ..models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.username", read_only=True, default="")
    action_label = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id", "actor", "actor_name", "action", "action_label",
            "target_type", "target_id", "target_label", "detail", "ip", "created_at",
        ]
        read_only_fields = fields
