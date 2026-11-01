"""Provider 协议与结果结构：平台侧只依赖这里的抽象，后端实现可整体替换。"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class PredictionItem:
    """单个候选类别。"""
    species_id: int | None
    chinese_name: str
    latin_name: str
    confidence: float
    count: int = 1
    bbox: list | None = None
    protection_level: str = "none"


@dataclass
class PredictResult:
    """一次推理的标准化结果。"""
    top_k: list[PredictionItem] = field(default_factory=list)
    model_version: str = ""
    provider: str = ""
    latency_ms: int = 0
    quality_flag: str = ""
    noise_ratio: float = 0.0
    separation_quality: float | None = None
    segments: list = field(default_factory=list)
    raw: dict = field(default_factory=dict)

    @property
    def top1(self) -> PredictionItem | None:
        return self.top_k[0] if self.top_k else None


class ProviderError(Exception):
    """推理服务不可用或返回异常，由调用方决定重试/降级。"""

    def __init__(self, message: str, code: str = "provider_error", retryable: bool = True):
        super().__init__(message)
        self.code = code
        self.retryable = retryable


class InferenceProvider(Protocol):
    """所有推理后端需实现的协议。"""

    name: str

    def predict_image(self, asset, context: dict) -> PredictResult: ...

    def predict_audio(self, asset, context: dict) -> PredictResult: ...

    def health(self) -> dict: ...
