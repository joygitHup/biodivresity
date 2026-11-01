"""系统配置读取：带 Redis 缓存，配置保存/删除时自动失效。

系统中多处运行时配置（识别调度、融合、训练等）原本每次都直接查库，
在融合周期任务等高频路径上会产生大量重复查询。统一走带缓存的读取，
写路径通过 system_config 模型的信号自动失效，无需调用方感知。
"""
from __future__ import annotations

from django.core.cache import cache

CACHE_TTL = 300  # 秒；信号失效为主，TTL 兜底防脏读


def _cache_key(key: str) -> str:
    return f"syscfg:{key}"


def get_config(key: str, default: str = "") -> str:
    """读取配置值：缓存 → 数据库 → CONFIG_DEFAULTS → default。"""
    # 延迟导入避免 app 加载期循环依赖
    from apps.system_config.models import CONFIG_DEFAULTS, SystemConfig

    cache_key = _cache_key(key)
    value = cache.get(cache_key)
    if value is None:
        value = SystemConfig.objects.filter(key=key).values_list("value", flat=True).first()
        if value is None:
            value = CONFIG_DEFAULTS.get(key, {}).get("default", default)
        cache.set(cache_key, value, CACHE_TTL)
    return value


def invalidate_config(key: str) -> None:
    cache.delete(_cache_key(key))
