"""Mock recognition service — simulates CNN inference.

In production this would call an actual PyTorch/ONNX model.
For now we return plausible mock results based on hash of the image bytes
so the same image always produces the same result.
"""
import hashlib
import random
from dataclasses import dataclass
from typing import List, Dict


@dataclass
class RecognizeResult:
    top_k: List[Dict]
    rejected: bool
    model_version: str = "v1.2.0"
    advisory: Dict = None


# Mock category pool (subset of PlantVillage-like categories)
MOCK_CATEGORIES = [
    {"id": "C0012", "name": "水稻稻瘟病", "path": "水稻/叶片/病害/稻瘟病"},
    {"id": "C0015", "name": "水稻胡麻斑病", "path": "水稻/叶片/病害/胡麻斑病"},
    {"id": "C0023", "name": "小麦锈病", "path": "小麦/叶片/病害/锈病"},
    {"id": "C0031", "name": "番茄晚疫病", "path": "番茄/叶片/病害/晚疫病"},
    {"id": "C0038", "name": "玉米螟", "path": "玉米/茎秆/虫害/玉米螟"},
    {"id": "C0045", "name": "柑橘红蜘蛛", "path": "柑橘/叶片/虫害/红蜘蛛"},
    {"id": "C0052", "name": "白菜软腐病", "path": "白菜/根茎/病害/软腐病"},
    {"id": "C0060", "name": "蚜虫", "path": "多种/叶片/虫害/蚜虫"},
    {"id": "C0067", "name": "健康植株", "path": "多种/整体/健康/健康"},
]

MOCK_ADVISORIES = {
    "病害": {
        "symptoms": "叶片出现病斑、黄化、萎蔫等症状",
        "conditions": "高湿、高温、通风不良环境易发病",
        "measures": "清除病株、合理密植、使用对应杀菌剂、轮作",
    },
    "虫害": {
        "symptoms": "叶片被啃食、出现虫洞、有虫粪或蜜露",
        "conditions": "干旱少雨、天敌少的环境虫害易爆发",
        "measures": "物理诱杀、生物防治、合理使用杀虫剂",
    },
    "健康": {
        "symptoms": "植株生长良好，叶片正常",
        "conditions": "管理得当，环境适宜",
        "measures": "继续保持现有管理措施，定期巡检",
    },
}


def _mock_inference(image_bytes: bytes) -> RecognizeResult:
    """Produce deterministic mock recognition result."""
    h = int(hashlib.md5(image_bytes).hexdigest(), 16)
    rng = random.Random(h)

    # Pick top-5 categories deterministically
    pool = list(MOCK_CATEGORIES)
    rng.shuffle(pool)
    top5 = pool[:5]

    # Generate confidence values that sum ~1.0
    confidences = sorted([rng.uniform(0.01, 0.4) for _ in range(5)], reverse=True)
    total = sum(confidences)
    confidences = [c / total for c in confidences]

    top_k = []
    for cat, conf in zip(top5, confidences):
        top_k.append({
            "category_id": cat["id"],
            "name": cat["name"],
            "path": cat["path"],
            "confidence": round(conf, 4),
        })

    # Determine rejection based on top confidence
    rejected = top_k[0]["confidence"] < 0.60

    # Pick advisory based on top result path
    top_path = top_k[0]["path"]
    if "虫害" in top_path:
        advisory = MOCK_ADVISORIES["虫害"]
    elif "病害" in top_path:
        advisory = MOCK_ADVISORIES["病害"]
    else:
        advisory = MOCK_ADVISORIES["健康"]

    return RecognizeResult(top_k=top_k, rejected=rejected, advisory=advisory)
