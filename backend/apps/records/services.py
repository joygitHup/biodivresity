"""复核业务规则：阈值解析与风险优先级计算。"""
from __future__ import annotations

from common.config import get_config

PROTECTED_LEVELS = {"national_1", "national_2", "provincial"}

# 声学质量降级：不强制复核，但抬高复核阈值
AUDIO_DEGRADED_FLAG = "audio_degraded"
AUDIO_DEGRADED_BUMP = 0.1
NON_BLOCKING_QUALITY_FLAGS = {AUDIO_DEGRADED_FLAG}

# 风险优先级（数值越小越先复核）
PRIORITY_PROTECTED_MID = 0      # 保护物种 + 中等置信度
PRIORITY_INVASIVE = 1           # 入侵物种
PRIORITY_PROTECTED_OTHER = 2    # 保护物种其他情况
PRIORITY_COMMON_LOW = 3         # 常见物种 + 极低置信度
PRIORITY_DEFAULT = 4


def _config_value(key: str) -> str:
    return get_config(key)


def config_value(key: str) -> str:
    return _config_value(key)


def config_bool(key: str, fallback: bool = False) -> bool:
    value = str(_config_value(key)).strip().lower()
    if value == "":
        return fallback
    return value in ("true", "1", "yes", "on")


def config_float(key: str, fallback: float = 0.0) -> float:
    try:
        return float(_config_value(key))
    except (TypeError, ValueError):
        return fallback


def config_int(key: str, fallback: int = 0) -> int:
    try:
        return int(float(_config_value(key)))
    except (TypeError, ValueError):
        return fallback


def resolve_threshold(species) -> float:
    """解析某物种的复核阈值。

    优先级：物种自定义阈值 > 保护等级默认 > 系统通用默认。
    """
    if species is None:
        return float(_config_value("review_threshold_common") or 0.6)
    if getattr(species, "review_threshold", None) is not None:
        return float(species.review_threshold)
    if species.protection_level in PROTECTED_LEVELS:
        return float(_config_value("review_threshold_protected") or 0.8)
    return float(_config_value("review_threshold_common") or 0.6)


def risk_priority(record, threshold: float) -> int:
    """计算复核风险优先级，保护物种+中等置信度最优先。"""
    level = record.species.protection_level if record.species else "none"
    conf = record.confidence or 0

    if level in PROTECTED_LEVELS:
        # 保护物种：中等置信度（0.5~阈值）风险最高
        if 0.5 <= conf < max(threshold, 0.6):
            return PRIORITY_PROTECTED_MID
        return PRIORITY_PROTECTED_OTHER
    if level == "invasive":
        return PRIORITY_INVASIVE
    if conf < 0.4:
        return PRIORITY_COMMON_LOW
    return PRIORITY_DEFAULT


def effective_threshold(record) -> float:
    """记录级复核阈值：声学降级数据在物种阈值基础上上浮。"""
    threshold = resolve_threshold(record.species)
    if (record.quality_flag or "") == AUDIO_DEGRADED_FLAG:
        threshold = min(threshold + AUDIO_DEGRADED_BUMP, 0.99)
    return threshold


def needs_review(record, threshold: float | None = None) -> bool:
    """是否需要人工复核：硬质量标记直接入队，降级标记只抬高阈值。"""
    flag = record.quality_flag or ""
    if flag and flag not in NON_BLOCKING_QUALITY_FLAGS:
        return True
    limit = threshold if threshold is not None else effective_threshold(record)
    return (record.confidence or 0) < limit


def should_auto_confirm(record) -> bool:
    """高置信度且无质量异常的记录自动确认，免人工复核。

    只对具备物种标签、无任何质量标记的记录生效；保护物种默认跳过，
    自动确认阈值不低于该记录的复核阈值，避免越过人工复核规则。
    """
    if not config_bool("auto_confirm_enabled", True):
        return False
    if record.species_id is None:
        return False
    if (record.quality_flag or "").strip():
        return False
    if config_bool("auto_confirm_skip_protected", True) \
            and record.species.protection_level in PROTECTED_LEVELS:
        return False
    limit = max(config_float("auto_confirm_threshold", 0.9), effective_threshold(record))
    return (record.confidence or 0) >= limit
