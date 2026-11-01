"""识别服务 — 基于平台类别档案的确定性 Mock 推理。

生产环境可替换为真实 CNN/ONNX 推理；此处按图像字节哈希生成稳定的 Top-5 结果，
类别取自「病虫害类别」档案，保证识别结果与作物-病虫害类别体系一致。
"""
import hashlib
import random
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class RecognizeResult:
    top_k: List[Dict]
    rejected: bool
    model_version: str = "plantvillage-r38"
    advisory: Optional[Dict] = None


def _category_rows(crop_id: str = "") -> list:
    """取类别档案；crop_id 为空时使用全部类别。"""
    from apps.species.models import Species

    qs = Species.objects.all()
    if crop_id:
        qs = qs.filter(crop=crop_id)
    return list(qs)


def _to_category(species) -> Dict:
    """把类别档案转成识别结果条目。"""
    return {
        "id": str(species.id),
        "name": species.chinese_name,
        "latin_name": species.latin_name,
        "path": "/".join(
            part for part in (
                species.get_crop_display(),
                species.get_part_display(),
                species.get_damage_type_display(),
                species.chinese_name,
            ) if part
        ),
        "severity": species.severity,
    }


def _advisory(species) -> Dict[str, str]:
    """根据类别档案生成防治建议。"""
    return {
        "damage_type": species.get_damage_type_display(),
        "severity": species.get_severity_display(),
        "symptoms": species.symptoms or "暂无记录",
        "measures": species.prevention or "暂无记录",
    }


def _mock_inference(image_bytes: bytes, crop_id: str = "") -> RecognizeResult:
    """按图像内容哈希生成确定性识别结果。"""
    rows = _category_rows(crop_id)
    if not rows:
        return RecognizeResult(top_k=[], rejected=True)

    rng = random.Random(int(hashlib.md5(image_bytes).hexdigest(), 16))
    picked = rng.sample(rows, min(5, len(rows)))

    top1_conf = round(rng.uniform(0.55, 0.97), 3)
    rest = sorted((rng.uniform(0.005, 0.2) for _ in range(len(picked) - 1)), reverse=True)
    rest_total = sum(rest) or 1
    confidences = [top1_conf] + [round(c * (1 - top1_conf) / rest_total, 3) for c in rest]

    top_k = []
    for species, conf in zip(picked, confidences):
        item = _to_category(species)
        item["confidence"] = conf
        top_k.append(item)

    top = picked[0]
    return RecognizeResult(
        top_k=top_k,
        rejected=top1_conf < 0.60,
        advisory=_advisory(top),
    )
