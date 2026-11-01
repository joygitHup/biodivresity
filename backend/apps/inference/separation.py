"""声源分离质量来源抽象。

- provider：直接使用推理服务返回的 separation_quality / noise_ratio（默认）
- http：调用独立分离模型服务，返回 quality / noise_ratio
- local：预留本地分离模型路径（AUDIO_SEPARATION_MODEL），当前仅占位

新增后端只需实现 SeparationBackend.analyze，并在 get_backend 注册。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import requests
from django.conf import settings

from .audio_quality import load_runtime_config

logger = logging.getLogger(__name__)


@dataclass
class SeparationOutput:
    quality: float | None
    noise_ratio: float | None
    provider: str
    detail: dict | None = None


def _config(key: str, env_name: str, default):
    value = load_runtime_config().get(key)
    if value not in (None, ""):
        return value
    return getattr(settings, env_name, default)


class ProviderBackend:
    """不额外计算，沿用推理服务的返回值。"""

    name = "provider"

    def analyze(self, path: str) -> SeparationOutput | None:
        return None


class HttpBackend:
    """独立分离服务：POST multipart file，返回 quality / noise_ratio。"""

    name = "http"

    def analyze(self, path: str) -> SeparationOutput | None:
        endpoint = str(_config("audio_separation_endpoint", "AUDIO_SEPARATION_ENDPOINT", "")).strip()
        if not endpoint:
            logger.info("未配置 audio_separation_endpoint，沿用 Provider 分离质量")
            return None
        timeout = int(getattr(settings, "AUDIO_SEPARATION_TIMEOUT", 15))
        try:
            with open(path, "rb") as fh:
                response = requests.post(
                    endpoint,
                    files={"file": (Path(path).name, fh)},
                    timeout=timeout,
                )
            response.raise_for_status()
            payload = response.json()
            data = payload.get("data", payload)
            quality = data.get("quality", data.get("separation_quality"))
            noise = data.get("noise_ratio")
            if quality is None:
                return None
            return SeparationOutput(
                quality=max(0.0, min(float(quality), 1.0)),
                noise_ratio=float(noise) if noise is not None else None,
                provider=self.name,
                detail=data,
            )
        except Exception:
            logger.warning("分离服务调用失败，回退 Provider 分离质量", exc_info=True)
            return None


class LocalBackend:
    """预留本地分离模型（如 Demucs / MossFormer），当前不启用。"""

    name = "local"

    def analyze(self, path: str) -> SeparationOutput | None:
        model_path = str(_config("audio_separation_model", "AUDIO_SEPARATION_MODEL", "")).strip()
        if not model_path:
            logger.info("未配置 audio_separation_model，本地分离后端未启用")
            return None
        logger.info("本地分离后端已预留（model=%s），当前仍使用 Provider 分离质量", model_path)
        return None


_BACKENDS = {
    "provider": ProviderBackend,
    "http": HttpBackend,
    "local": LocalBackend,
}


def get_backend(mode: str | None = None):
    resolved = (mode or _config("audio_separation_mode", "AUDIO_SEPARATION_MODE", "provider"))
    resolved = str(resolved).strip().lower()
    backend_cls = _BACKENDS.get(resolved, ProviderBackend)
    return backend_cls()


def resolve_separation(path: str, provider_quality: float | None,
                       provider_noise: float | None) -> tuple[float | None, float | None]:
    """按配置解析分离质量；外部后端不可用时回退 Provider 返回值。"""
    backend = get_backend()
    if backend.name == "provider":
        return provider_quality, provider_noise
    output = backend.analyze(path)
    if output is None:
        return provider_quality, provider_noise
    return output.quality, output.noise_ratio
