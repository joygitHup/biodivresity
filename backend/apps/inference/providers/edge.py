"""边缘端轻量推理后端（演示实现）。

真实部署中边缘模型运行在网关/设备侧，平台通过「边缘结果上报」接口接收结果；
这里提供一个确定性的轻量模拟器，用于本地联调与演示。
"""
from __future__ import annotations

import hashlib
import random
import time

from apps.species.models import Species

from .base import InferenceProvider, PredictionItem, PredictResult
from ..models import MediaAsset


class MockEdgeProvider(InferenceProvider):
    """低算力、低延迟的轻量模型模拟：置信度普遍低于云端，简单样本可直接直判。"""

    name = "edge"

    def _build_result(self, asset: MediaAsset, task_type: str) -> PredictResult:
        started = time.perf_counter()
        seed = int(hashlib.sha256(f"{asset.sha256}:{task_type}:edge".encode()).hexdigest()[:8], 16)
        rnd = random.Random(seed)

        species = list(Species.objects.all()[:60])
        if not species:
            raise RuntimeError("物种库为空，无法生成边缘识别结果")
        # 多数样本命中常见物种，保留部分保护物种样本用于验证强制上云
        common = [sp for sp in species if sp.protection_level == "none"]
        pool = common if common and rnd.random() < 0.65 else species
        picked = rnd.sample(pool, min(3, len(pool)))

        # 约 45% 为「简单样本」：高置信且与次优有明显差距，可边缘直判
        if rnd.random() < 0.45:
            top1 = rnd.uniform(0.86, 0.985)
            gap = rnd.uniform(0.16, 0.36)
        else:
            top1 = rnd.uniform(0.45, 0.84)
            gap = rnd.uniform(0.02, 0.12)

        confidences = [top1, max(top1 - gap, 0.02)]
        if len(picked) > 2:
            confidences.append(max(confidences[1] - rnd.uniform(0.05, 0.2), 0.01))

        items = [
            PredictionItem(
                species_id=sp.id,
                chinese_name=sp.chinese_name,
                latin_name=sp.latin_name,
                confidence=round(conf, 4),
                count=1,
                protection_level=sp.protection_level,
            )
            for sp, conf in zip(picked, confidences)
        ]

        quality_flag = ""
        noise_ratio = 0.0
        separation_quality = None
        if task_type == MediaAsset.SourceType.AUDIO:
            noise_ratio = round(rnd.uniform(0.08, 0.55), 2)
            separation_quality = round(rnd.uniform(0.35, 0.9), 2)
            if noise_ratio > 0.45:
                quality_flag = "high_noise"
            elif separation_quality < 0.5:
                quality_flag = "unreliable_separation"

        latency = max(int((time.perf_counter() - started) * 1000), rnd.randint(6, 22))
        return PredictResult(
            top_k=items,
            model_version="edge-v0.4.0",
            provider=self.name,
            latency_ms=latency,
            quality_flag=quality_flag,
            noise_ratio=noise_ratio,
            separation_quality=separation_quality,
            raw={"note": "mock edge provider, deterministic by file hash", "tier": "edge"},
        )

    def predict_image(self, asset, context: dict) -> PredictResult:
        return self._build_result(asset, MediaAsset.SourceType.IMAGE)

    def predict_audio(self, asset, context: dict) -> PredictResult:
        return self._build_result(asset, MediaAsset.SourceType.AUDIO)

    def health(self) -> dict:
        return {"status": "ok", "provider": self.name, "model_version": "edge-v0.4.0"}
