"""Provider 工厂：按配置选择推理后端，业务代码不感知具体实现。"""
from __future__ import annotations

from django.conf import settings
from django.utils.module_loading import import_string

from common.config import get_config

from .base import InferenceProvider
from .edge import MockEdgeProvider
from .mock import MockProvider
from .remote import RemoteHttpProvider
from .remote_edge import RemoteEdgeProvider

_REGISTRY = {
    "mock": "apps.inference.providers.mock.MockProvider",
    "http": "apps.inference.providers.remote.RemoteHttpProvider",
    "edge": "apps.inference.providers.edge.MockEdgeProvider",
    "edge_http": "apps.inference.providers.remote_edge.RemoteEdgeProvider",
}

_CACHE: dict[str, InferenceProvider] = {}


def _edge_provider_type() -> str:
    """从运行时配置读取边缘 Provider 类型，页面修改后即时生效。"""
    value = str(get_config("edge_provider_type", "mock")).strip().lower()
    # http → 远程边缘 HTTP 服务(edge_http)；mock → 本地边缘模拟(edge)
    if value == "http":
        return "edge_http"
    return "edge"


def get_provider(name: str | None = None) -> InferenceProvider:
    """返回 Provider 单例。name 为空时取 INFERENCE_PROVIDER 配置。"""
    key = (name or settings.INFERENCE_PROVIDER or "mock").lower()

    if key not in _REGISTRY:
        raise ValueError(f"未知的推理后端: {key}")

    if key not in _CACHE:
        provider_cls = import_string(_REGISTRY[key])
        _CACHE[key] = provider_cls()
    return _CACHE[key]


def get_edge_provider() -> InferenceProvider:
    """边缘端轻量模型后端；类型由运行时配置 edge_provider_type 决定。"""
    return get_provider(_edge_provider_type())


__all__ = [
    "get_provider", "get_edge_provider",
    "MockEdgeProvider", "MockProvider", "RemoteHttpProvider", "RemoteEdgeProvider",
]
