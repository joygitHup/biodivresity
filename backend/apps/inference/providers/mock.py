"""Mock 推理后端：不依赖 GPU 也能跑通完整任务闭环。"""
from __future__ import annotations

import hashlib
import random
import time

from apps.species.models import Species

from .base import InferenceProvider, PredictionItem, PredictResult
from ..models import MediaAsset


class MockProvider(InferenceProvider):
    """基于文件哈希的确定性伪推理，便于测试与演示。"""

    name = "mock"

    def _seeded_random(self, asset: MediaAsset, salt: str) -> random.Random:
        seed_src = f"{asset.sha256}:{salt}".encode("utf-8")
        seed = int(hashlib.sha256(seed_src).hexdigest()[:8], 16)
        return random.Random(seed)

    def _build_result(self, asset: MediaAsset, task_type: str) -> PredictResult:
        started = time.perf_counter()
        rnd = self._seeded_random(asset, task_type)

        species = list(Species.objects.all()[:60])
        if not species:
            raise RuntimeError("物种库为空，无法生成模拟识别结果")

        picked = rnd.sample(species, min(5, len(species)))
        raw_scores = sorted((rnd.random() for _ in picked), reverse=True)
        total = sum(raw_scores) or 1
        weights = [s / total for s in raw_scores]

        items = []
        for sp, weight in zip(picked, weights):
            items.append(PredictionItem(
                species_id=sp.id,
                chinese_name=sp.chinese_name,
                latin_name=sp.latin_name,
                confidence=round(min(weight, 0.99), 4),
                count=1,
                severity=sp.severity,
            ))

        quality_flag = ""
        noise_ratio = 0.0
        separation_quality = None
        if task_type == MediaAsset.SourceType.AUDIO:
            noise_ratio = round(rnd.uniform(0.1, 0.6), 2)
            separation_quality = round(rnd.uniform(0.4, 0.95), 2)
            if noise_ratio > 0.45:
                quality_flag = "high_noise"
            elif separation_quality < 0.5:
                quality_flag = "unreliable_separation"

        latency = int((time.perf_counter() - started) * 1000)
        return PredictResult(
            top_k=items,
            model_version="mock-v1.0.0",
            provider=self.name,
            latency_ms=latency,
            quality_flag=quality_flag,
            noise_ratio=noise_ratio,
            separation_quality=separation_quality,
            raw={"note": "mock provider, deterministic by file hash"},
        )

    def predict_image(self, asset, context: dict) -> PredictResult:
        return self._build_result(asset, MediaAsset.SourceType.IMAGE)

    def predict_audio(self, asset, context: dict) -> PredictResult:
        return self._build_result(asset, MediaAsset.SourceType.AUDIO)

    def health(self) -> dict:
        return {"status": "ok", "provider": self.name, "model_version": "mock-v1.0.0"}
