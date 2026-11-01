"""边缘设备鉴权：支持 JWT（管理端）与设备级 Token（网关上报）两种方式。"""
from __future__ import annotations

from rest_framework import authentication, exceptions

from apps.devices.models import Device


class EdgeDeviceTokenAuthentication(authentication.BaseAuthentication):
    """通过 X-Device-Token 请求头识别边缘设备。

    用于边缘网关上报识别结果场景：设备无需用户账号，用预分配的 Token 鉴权。
    认证成功后 request.device 指向对应设备，request.user 为匿名。
    """

    keyword = "X-Device-Token"

    def authenticate(self, request):
        token = request.META.get("HTTP_X_DEVICE_TOKEN") or request.headers.get(
            "X-Device-Token", "",
        )
        if not token:
            return None  # 未携带设备 Token，交由其他认证类（如 JWT）处理

        # 遍历具备边缘能力的设备校验 Token（数量有限，线性扫描可接受）
        for device in Device.objects.filter(edge_enabled=True).exclude(edge_token_hash=""):
            if device.verify_edge_token(token):
                request.device = device  # type: ignore[attr-defined]
                return (None, device)
        raise exceptions.AuthenticationFailed("无效的设备 Token")
