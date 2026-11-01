"""System config views — GET merged dict, PUT bulk upsert."""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from common.permissions import IsAdminRole
from .models import SystemConfig, CONFIG_DEFAULTS


class SystemConfigView(APIView):
    """系统配置读取与批量更新。"""

    def get_permissions(self):
        if self.request.method in ["PUT", "PATCH"]:
            return [IsAdminRole()]
        return [IsAuthenticated()]

    @extend_schema(summary="获取系统配置")
    def get(self, request):
        stored = {c.key: c.value for c in SystemConfig.objects.all()}
        data = {
            key: stored.get(key, meta["default"])
            for key, meta in CONFIG_DEFAULTS.items()
        }
        descriptions = {key: meta["description"] for key, meta in CONFIG_DEFAULTS.items()}
        return Response({"code": 0, "message": "ok", "data": {"config": data, "descriptions": descriptions}})

    @extend_schema(summary="批量更新系统配置(管理员)")
    def put(self, request):
        updates = request.data.get("config", {})
        if not isinstance(updates, dict):
            return Response(
                {"code": 40001, "message": "config 必须是键值对对象"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        unknown = [k for k in updates if k not in CONFIG_DEFAULTS]
        if unknown:
            return Response(
                {"code": 40001, "message": f"不支持的配置项: {', '.join(unknown)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for key, value in updates.items():
            SystemConfig.objects.update_or_create(
                key=key,
                defaults={
                    "value": str(value),
                    "description": CONFIG_DEFAULTS[key]["description"],
                },
            )
        from apps.users.audit import audit_action
        audit_action(
            request, "config_change",
            target_type="system_config",
            detail=f"更新了 {len(updates)} 项系统配置：{', '.join(updates.keys())}",
        )
        return self.get(request)
