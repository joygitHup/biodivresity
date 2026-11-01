"""跨模态证据融合服务。

MVP：同物种 × 同样区 × 时间窗内聚合图像/视频、声学、eDNA 证据，按模态权重与
可靠性系数做加权 logit 融合，输出融合置信度、证据等级与复核状态。

增强版：时间衰减、空间核降权、低质量证据剔除、eDNA 阴性语义、跨物种冲突检测，
全部通过 SystemConfig 运行时开关与参数控制，无需重启服务。
"""
from __future__ import annotations

import logging
import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone as dt_timezone

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.records.models import MonitorRecord
from apps.system_config.models import SystemConfig
from common.config import get_config

from .models import ClusterEvidence, EdnaEvidence, EvidenceCluster, FusionReviewLog

logger = logging.getLogger(__name__)

EPSILON = 1e-6
MODALITY_WEIGHT_KEYS = {
    ClusterEvidence.Modality.IMAGE: "fusion_weight_image",
    ClusterEvidence.Modality.AUDIO: "fusion_weight_audio",
    ClusterEvidence.Modality.EDNA: "fusion_weight_edna",
}


# ── 配置读取 ─────────────────────────────────────────────────


def _raw(key: str) -> str:
    return get_config(key)


def _float(key: str, fallback: float = 0.0) -> float:
    try:
        return float(_raw(key))
    except (TypeError, ValueError):
        return fallback


def _int(key: str, fallback: int = 0) -> int:
    try:
        return int(float(_raw(key)))
    except (TypeError, ValueError):
        return fallback


def _bool(key: str, fallback: bool = False) -> bool:
    value = _raw(key)
    if value == "":
        return fallback
    return str(value).strip().lower() in ("true", "1", "yes", "on")


def fusion_enabled() -> bool:
    return _bool("fusion_enabled", True)


# ── 数学工具 ─────────────────────────────────────────────────


def _clip(value: float, low: float = EPSILON, high: float = 1 - EPSILON) -> float:
    return max(low, min(high, float(value or 0)))


def _logit(p: float) -> float:
    p = _clip(p)
    return math.log(p / (1 - p))


def _sigmoid(z: float) -> float:
    if z >= 0:
        return 1 / (1 + math.exp(-z))
    exp_z = math.exp(z)
    return exp_z / (1 + exp_z)


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine 球面距离，用于空间核降权。"""
    radius = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def window_bounds(moment: datetime, hours: int) -> tuple[datetime, datetime]:
    """按固定小时窗口对齐，保证重建结果稳定可复现。"""
    span = max(hours, 1) * 3600
    epoch = int(moment.timestamp())
    start_epoch = epoch - (epoch % span)
    start = datetime.fromtimestamp(start_epoch, tz=dt_timezone.utc)
    return start, start + timedelta(seconds=span)


# ── 证据权重 ─────────────────────────────────────────────────


def _time_decay(observed_at: datetime, window_start: datetime, window_end: datetime) -> float:
    """增强版：距离时间窗中心越远权重越低（指数半衰期）。"""
    if not _bool("fusion_time_decay_enabled", True):
        return 1.0
    half_life = _float("fusion_time_decay_half_life_hours", 24)
    if half_life <= 0:
        return 1.0
    center = window_start + (window_end - window_start) / 2
    age_hours = abs((observed_at - center).total_seconds()) / 3600
    return max(0.05, 0.5 ** (age_hours / half_life))


def _spatial_weight(lat, lng, area) -> float:
    """增强版：依据与样区中心距离做高斯核降权，缺失坐标时按 1.0 处理。"""
    if not _bool("fusion_spatial_enabled", True):
        return 1.0
    if lat is None or lng is None or area is None:
        return 1.0
    sigma = _float("fusion_spatial_radius_km", 5)
    if sigma <= 0:
        return 1.0
    distance = _distance_km(lat, lng, area.lat, area.lng)
    return max(0.1, math.exp(-(distance * distance) / (2 * sigma * sigma)))


def _record_modality(record: MonitorRecord) -> str:
    if record.media_type == MonitorRecord.MediaType.AUDIO:
        return ClusterEvidence.Modality.AUDIO
    # 视频归入视觉证据，与图像共享同一模态权重
    return ClusterEvidence.Modality.IMAGE


def _record_reliability(record: MonitorRecord, modality: str) -> float:
    floor = _float("fusion_reliability_floor", 0.35)
    if modality == ClusterEvidence.Modality.AUDIO:
        if record.audio_reliability is not None:
            score = float(record.audio_reliability)
        else:
            score = {"reliable": 1.0, "degraded": 0.7, "unreliable": 0.35}.get(
                record.audio_grade or "", 1.0,
            )
        if (record.quality_flag or "") == "audio_unreliable":
            score = min(score, 0.3)
        if (record.audio_grade or "") == "unreliable":
            score = min(score, 0.35)
        return max(score, floor)
    if record.quality_flag:
        return 0.7
    return 1.0


def _record_entry(record: MonitorRecord, window_start: datetime, window_end: datetime,
                  *, review_integration: bool = False,
                  review_boost: float = 1.0) -> dict | None:
    """构建监测记录证据；复核接入开启时，已驳回记录返回 None 表示剔除。"""
    if review_integration and record.review_status == MonitorRecord.ReviewStatus.REJECTED:
        return None
    modality = _record_modality(record)
    confidence = _clip(record.confidence)
    reliability = _record_reliability(record, modality)
    # 人工已确认/已纠正的记录提升可靠性，让复核结论影响融合权重
    if review_integration and record.review_status in (
        MonitorRecord.ReviewStatus.CONFIRMED, MonitorRecord.ReviewStatus.CORRECTED,
    ):
        reliability = min(1.0, reliability * max(review_boost, 1.0))
    # 纠正后的物种优先于 AI 原始识别结果参与分组
    species_id = record.species_id
    if review_integration and record.review_status == MonitorRecord.ReviewStatus.CORRECTED \
            and record.corrected_species_id:
        species_id = record.corrected_species_id
    # 视频单独设权重；图像/视频仍共享同一「视觉」模态参与模态计数
    weight_key = "fusion_weight_video" if record.media_type == MonitorRecord.MediaType.VIDEO \
        else MODALITY_WEIGHT_KEYS[modality]
    device = record.device
    lat = record.lat if record.lat is not None else (device.lat if device else None)
    lng = record.lng if record.lng is not None else (device.lng if device else None)
    weight = (
        _float(weight_key, 1.0)
        * reliability
        * _time_decay(record.timestamp, window_start, window_end)
        * _spatial_weight(lat, lng, record.survey_area)
    )
    return {
        "modality": modality,
        "species_id": species_id,
        "monitor_record": record,
        "edna_evidence": None,
        "confidence": confidence,
        "reliability": reliability,
        "weight": weight,
        "role": ClusterEvidence.Role.SUPPORT,
        "observed_at": record.timestamp,
        "source_label": device.name if device else "监测记录",
        "lat": lat,
        "lng": lng,
    }


def _edna_entry(evidence: EdnaEvidence, window_start: datetime,
                window_end: datetime) -> dict | None:
    confidence = _clip(evidence.detection_confidence, 0.01, 0.99)
    is_negative = evidence.result == EdnaEvidence.Result.NEGATIVE
    if is_negative and not _bool("fusion_edna_negative_enabled", True):
        # MVP 默认只把阳性结果作为支持证据；阴性语义由增强版开关启用
        return None
    # 阳性：置信度即存在概率；阴性：置信度越高，存在概率越低
    presence = (1 - confidence) if is_negative else confidence
    weight = (
        _float("fusion_weight_edna", 1.0)
        * _time_decay(evidence.sampled_at, window_start, window_end)
        * _spatial_weight(
            evidence.lat if evidence.lat is not None else (evidence.device.lat if evidence.device else None),
            evidence.lng if evidence.lng is not None else (evidence.device.lng if evidence.device else None),
            evidence.survey_area,
        )
    )
    if is_negative:
        weight *= _float("fusion_negative_penalty", 0.5)
    return {
        "modality": ClusterEvidence.Modality.EDNA,
        "monitor_record": None,
        "edna_evidence": evidence,
        "confidence": presence,
        "reliability": 1.0,
        "weight": weight,
        "role": ClusterEvidence.Role.NEGATIVE if is_negative else ClusterEvidence.Role.SUPPORT,
        "observed_at": evidence.sampled_at,
        "source_label": evidence.sample_code or "eDNA样本",
        "lat": evidence.lat,
        "lng": evidence.lng,
    }


# ── 融合计算 ─────────────────────────────────────────────────


def fuse_entries(entries: list[dict]) -> tuple[float, float] | None:
    """加权 logit 融合，返回 (融合置信度, 总权重)。"""
    effective = [e for e in entries if e["weight"] > 0]
    total_weight = sum(e["weight"] for e in effective)
    if total_weight <= 0:
        return None
    weighted_logit = sum(e["weight"] * _logit(e["confidence"]) for e in effective)
    return _sigmoid(weighted_logit / total_weight), total_weight


def _modality_count(entries: list[dict]) -> int:
    return len({e["modality"] for e in entries})


def grade_for(confidence: float, modality_count: int, conflict: bool) -> str:
    if conflict:
        return EvidenceCluster.Grade.CONFLICT
    if modality_count < _int("fusion_min_modalities", 2) or confidence <= 0:
        return EvidenceCluster.Grade.INSUFFICIENT
    if confidence >= _float("fusion_confidence_threshold", 0.8):
        return EvidenceCluster.Grade.STRONG
    if confidence >= _float("fusion_review_threshold", 0.6):
        return EvidenceCluster.Grade.MODERATE
    return EvidenceCluster.Grade.WEAK


def _internal_conflict(entries: list[dict]) -> str:
    """同簇内 eDNA 阴性与视觉/声学阳性同时出现，视为直接矛盾。"""
    has_negative = any(e["role"] == ClusterEvidence.Role.NEGATIVE for e in entries)
    has_strong_support = any(
        e["role"] == ClusterEvidence.Role.SUPPORT
        and e["modality"] != ClusterEvidence.Modality.EDNA
        and e["confidence"] >= 0.6
        for e in entries
    )
    if has_negative and has_strong_support:
        return "eDNA 阴性结果与图像/声学阳性证据矛盾，需人工判定"
    return ""


def _summary(entries: list[dict], total_weight: float) -> dict:
    summary: dict[str, dict] = {}
    for entry in entries:
        bucket = summary.setdefault(entry["modality"], {
            "count": 0, "weight": 0.0, "avgConfidence": 0.0, "support": 0, "negative": 0,
        })
        bucket["count"] += 1
        bucket["weight"] += entry["weight"]
        bucket["avgConfidence"] += entry["confidence"]
        bucket[entry["role"]] += 1
    for bucket in summary.values():
        if bucket["count"]:
            bucket["avgConfidence"] = round(bucket["avgConfidence"] / bucket["count"], 4)
        bucket["weight"] = round(bucket["weight"], 4)
    if total_weight > 0:
        for bucket in summary.values():
            bucket["weightShare"] = round(bucket["weight"] / total_weight, 4)
    return summary


# ── 窗口重建 ─────────────────────────────────────────────────


@transaction.atomic
def rebuild_window(window_start: datetime, window_end: datetime) -> dict:
    """重建单个时间窗内的全部证据簇（幂等）。"""
    if not fusion_enabled():
        return {"clusters": 0, "deleted": 0}

    min_reliability = _float("fusion_min_evidence_reliability", 0.2)
    review_integration = _bool("fusion_review_integration_enabled", True)
    review_boost = _float("fusion_reviewed_boost", 1.2)
    groups: dict[tuple[int, int], list[dict]] = defaultdict(list)

    # 物种为空但已被纠正出有效物种的记录也需纳入，故在 Python 侧判定有效物种
    records = (
        MonitorRecord.objects.filter(
            Q(species__isnull=False) | Q(corrected_species__isnull=False),
            timestamp__gte=window_start, timestamp__lt=window_end,
            survey_area__isnull=False,
        )
        .select_related("species", "corrected_species", "survey_area", "device")
    )
    for record in records:
        entry = _record_entry(record, window_start, window_end,
                              review_integration=review_integration,
                              review_boost=review_boost)
        if entry is None or entry["reliability"] < min_reliability:
            continue
        if not entry["species_id"]:
            continue
        groups[(entry["species_id"], record.survey_area_id)].append(entry)

    edna_qs = EdnaEvidence.objects.filter(
        sampled_at__gte=window_start, sampled_at__lt=window_end,
    ).select_related("species", "survey_area", "device")
    for evidence in edna_qs:
        entry = _edna_entry(evidence, window_start, window_end)
        if entry is None:
            continue
        groups[(evidence.species_id, evidence.survey_area_id)].append(entry)

    computed: list[dict] = []
    kept_ids: list[int] = []

    for (species_id, area_id), entries in groups.items():
        fused = fuse_entries(entries)
        if fused is None:
            continue
        confidence, total_weight = fused
        modality_count = _modality_count(entries)
        conflict_note = _internal_conflict(entries)
        cluster, _ = EvidenceCluster.objects.update_or_create(
            species_id=species_id,
            survey_area_id=area_id,
            window_start=window_start,
            defaults={
                "window_end": window_end,
                "device": next((e["monitor_record"].device for e in entries
                                if e["monitor_record"] and e["monitor_record"].device), None),
                "fused_confidence": round(confidence, 4),
                "fused_grade": grade_for(confidence, modality_count, bool(conflict_note)),
                "evidence_count": len(entries),
                "modality_count": modality_count,
                "modalities": sorted({e["modality"] for e in entries}),
                "has_image": any(e["modality"] == ClusterEvidence.Modality.IMAGE for e in entries),
                "has_audio": any(e["modality"] == ClusterEvidence.Modality.AUDIO for e in entries),
                "has_edna": any(e["modality"] == ClusterEvidence.Modality.EDNA for e in entries),
                "evidence_summary": _summary(entries, total_weight),
                "conflict_flag": bool(conflict_note),
                "conflict_note": conflict_note,
                "last_computed_at": timezone.now(),
            },
        )
        cluster.evidences.all().delete()
        ClusterEvidence.objects.bulk_create([
            ClusterEvidence(
                cluster=cluster,
                modality=e["modality"],
                monitor_record=e["monitor_record"],
                edna_evidence=e["edna_evidence"],
                confidence=round(e["confidence"], 4),
                reliability=round(e["reliability"], 4),
                weight=round(e["weight"], 4),
                logit_value=round(e["weight"] * _logit(e["confidence"]), 4),
                role=e["role"],
                observed_at=e["observed_at"],
                source_label=e["source_label"][:120],
            )
            for e in entries
        ])
        kept_ids.append(cluster.id)
        computed.append({
            "cluster": cluster,
            "confidence": confidence,
            "modality_count": modality_count,
            "conflict": bool(conflict_note),
        })

    _mark_cross_species_conflicts(computed)
    _sync_strong_alerts(computed)

    deleted = 0
    if kept_ids:
        deleted, _ = (
            EvidenceCluster.objects.filter(window_start=window_start,
                                           status=EvidenceCluster.Status.PENDING)
            .exclude(pk__in=kept_ids)
            .delete()
        )
    else:
        deleted, _ = EvidenceCluster.objects.filter(
            window_start=window_start, status=EvidenceCluster.Status.PENDING,
        ).delete()

    return {"clusters": len(computed), "deleted": deleted}


def _mark_cross_species_conflicts(computed: list[dict]) -> None:
    """增强版：同区域同时段出现多个高置信多模态物种时提示人工核对。"""
    if not _bool("fusion_conflict_detection_enabled", True):
        return
    threshold = _float("fusion_confidence_threshold", 0.8)
    margin = _float("fusion_conflict_margin", 0.2)
    by_area: dict[int, list[dict]] = defaultdict(list)
    for item in computed:
        if item["modality_count"] >= 2:
            by_area[item["cluster"].survey_area_id].append(item)

    for items in by_area.values():
        for current in items:
            if current["conflict"] or current["confidence"] < threshold:
                continue
            for other in items:
                if other["cluster"].species_id == current["cluster"].species_id:
                    continue
                if other["confidence"] < threshold:
                    continue
                if other["confidence"] < current["confidence"] + margin:
                    continue
                cluster = current["cluster"]
                cluster.conflict_flag = True
                cluster.conflict_note = (
                    f"同区域同时段「{other['cluster'].species.chinese_name}」融合置信度更高，"
                    "建议核对物种判定"
                )
                cluster.fused_grade = EvidenceCluster.Grade.CONFLICT
                cluster.save(update_fields=["conflict_flag", "conflict_note", "fused_grade"])
                current["conflict"] = True
                break


def _sync_strong_alerts(computed: list[dict]) -> None:
    """强证据自动预警：保护物种/入侵物种生成预警，按证据簇去重。"""
    if not _bool("fusion_auto_alert_enabled", True):
        return
    from apps.alerts.models import Alert

    levels = {"national_1", "national_2", "provincial", "invasive"}
    for item in computed:
        cluster: EvidenceCluster = item["cluster"]
        if item["conflict"] or cluster.fused_grade != EvidenceCluster.Grade.STRONG:
            continue
        level = cluster.species.protection_level
        if level not in levels:
            continue
        source_ref = f"fusion:{cluster.id}"
        if Alert.objects.filter(source=Alert.Source.FUSION, source_ref=source_ref).exists():
            continue
        alert_type = (Alert.Type.INVASIVE_SPECIES if level == "invasive"
                      else Alert.Type.PROTECTION_ANOMALY)
        alert_level = (Alert.Level.CRITICAL if level in ("national_1", "invasive")
                       else Alert.Level.WARNING)
        window = f"{timezone.localtime(cluster.window_start):%m-%d %H:%M} ~ " \
                 f"{timezone.localtime(cluster.window_end):%m-%d %H:%M}"
        Alert.objects.create(
            type=alert_type,
            level=alert_level,
            title=f"跨模态强证据：{cluster.species.chinese_name} · {cluster.survey_area.name}",
            description=(
                f"时间窗 {window}，融合置信度 {cluster.fused_confidence:.1%}，"
                f"模态 {'/'.join(cluster.modalities)}，共 {cluster.evidence_count} 条证据。"
            ),
            survey_area=cluster.survey_area,
            source=Alert.Source.FUSION,
            source_ref=source_ref,
        )


def rebuild_range(start: datetime, end: datetime) -> dict:
    """按时间窗逐段重建，返回汇总统计。"""
    hours = _int("fusion_window_hours", 24)
    cursor, _ = window_bounds(start, hours)
    summary = {"windows": 0, "clusters": 0, "deleted": 0}
    while cursor < end:
        outcome = rebuild_window(cursor, cursor + timedelta(hours=hours))
        summary["windows"] += 1
        summary["clusters"] += outcome["clusters"]
        summary["deleted"] += outcome["deleted"]
        cursor += timedelta(hours=hours)
    if fusion_enabled():
        mark_rebuild_done()
    return summary


def mark_rebuild_done() -> None:
    """记录最近一次重建时间，供周期任务按可配置间隔跳过重复执行。"""
    SystemConfig.objects.update_or_create(
        key="fusion_last_rebuild_at",
        defaults={
            "value": timezone.now().isoformat(),
            "description": "最近一次证据融合重建时间（系统记录）",
        },
    )


def maybe_rebuild_recent() -> dict:
    """周期任务入口：按 fusion_rebuild_interval_minutes 控制实际重建频率。"""
    if not fusion_enabled():
        return {"skipped": True, "reason": "disabled"}
    interval = max(1, _int("fusion_rebuild_interval_minutes", 5))
    raw = SystemConfig.objects.filter(
        key="fusion_last_rebuild_at",
    ).values_list("value", flat=True).first()
    if raw:
        try:
            last = datetime.fromisoformat(raw)
        except (TypeError, ValueError):
            last = None
        if last is not None:
            if timezone.is_naive(last):
                last = timezone.make_aware(last)
            if timezone.now() - last < timedelta(minutes=interval):
                return {"skipped": True, "reason": "interval", "intervalMinutes": interval}
    summary = rebuild_recent()
    summary["skipped"] = False
    return summary


def rebuild_recent(lookback_hours: int | None = None) -> dict:
    """周期任务入口：重建最近若干小时的证据簇。"""
    if not fusion_enabled():
        return {"windows": 0, "clusters": 0, "deleted": 0, "enabled": False}
    hours = lookback_hours or _int("fusion_rebuild_lookback_hours", 48)
    now = timezone.now()
    summary = rebuild_range(now - timedelta(hours=hours), now)
    summary["enabled"] = True
    return summary


def rebuild_for_evidence(evidence: EdnaEvidence) -> dict:
    """eDNA 证据录入后，仅重建其所在时间窗，避免全量扫描。"""
    hours = _int("fusion_window_hours", 24)
    start, end = window_bounds(evidence.sampled_at, hours)
    return rebuild_window(start, end)


def rebuild_for_record(record: MonitorRecord) -> dict:
    """单条记录复核后重建其所在时间窗，使复核结论即时反映到融合结果。"""
    if not fusion_enabled():
        return {"clusters": 0, "deleted": 0}
    hours = _int("fusion_window_hours", 24)
    start, end = window_bounds(record.timestamp, hours)
    return rebuild_window(start, end)


def rebuild_for_records(timestamps: list[datetime]) -> dict:
    """批量复核后重建涉及的全部时间窗（按窗口去重，幂等）。"""
    if not fusion_enabled() or not timestamps:
        return {"windows": 0}
    hours = _int("fusion_window_hours", 24)
    windows = sorted({window_bounds(ts, hours)[0] for ts in timestamps})
    for start in windows:
        rebuild_window(start, start + timedelta(hours=hours))
    return {"windows": len(windows)}


def record_review(cluster: EvidenceCluster, action: str, operator, remark: str = "") -> None:
    """写入复核结果与留痕。"""
    cluster.status = action
    cluster.reviewer = operator
    cluster.reviewed_at = timezone.now()
    if remark:
        cluster.remark = remark
    cluster.save(update_fields=["status", "reviewer", "reviewed_at", "remark"])
    FusionReviewLog.objects.create(
        cluster=cluster, action=action, operator=operator, remark=remark,
    )


# ── 统计 ─────────────────────────────────────────────────────


def distribution_stats(days: int = 30) -> list[dict]:
    """强证据/已确认证据的物种分布聚合，可按样区接入统计分析。"""
    since = timezone.now() - timedelta(days=max(1, min(days, 365)))
    qs = (
        EvidenceCluster.objects
        .filter(window_start__gte=since)
        .filter(Q(fused_grade=EvidenceCluster.Grade.STRONG)
                | Q(status=EvidenceCluster.Status.CONFIRMED))
        .select_related("species", "survey_area")
    )
    buckets: dict[tuple[int, int], dict] = {}
    for cluster in qs:
        key = (cluster.survey_area_id, cluster.species_id)
        row = buckets.setdefault(key, {
            "surveyAreaId": cluster.survey_area_id,
            "surveyAreaName": cluster.survey_area.name,
            "speciesId": cluster.species_id,
            "speciesName": cluster.species.chinese_name,
            "speciesLatinName": cluster.species.latin_name,
            "protectionLevel": cluster.species.protection_level,
            "clusterCount": 0,
            "maxConfidence": 0.0,
            "modalities": set(),
            "lastSeen": cluster.window_end,
        })
        row["clusterCount"] += 1
        row["maxConfidence"] = max(row["maxConfidence"], cluster.fused_confidence)
        row["modalities"].update(cluster.modalities or [])
        row["lastSeen"] = max(row["lastSeen"], cluster.window_end)

    rows = []
    for row in buckets.values():
        row["maxConfidence"] = round(row["maxConfidence"], 4)
        row["modalities"] = sorted(row["modalities"])
        row["lastSeen"] = row["lastSeen"].isoformat()
        rows.append(row)
    rows.sort(key=lambda item: (item["surveyAreaId"], -item["maxConfidence"]))
    return rows


def fusion_stats() -> dict:
    clusters = EvidenceCluster.objects.all()
    total = clusters.count()
    pending = clusters.filter(status=EvidenceCluster.Status.PENDING).count()
    confirmed = clusters.filter(status=EvidenceCluster.Status.CONFIRMED).count()
    rejected = clusters.filter(status=EvidenceCluster.Status.REJECTED).count()
    multi_modal = clusters.filter(modality_count__gte=2).count()
    conflict = clusters.filter(conflict_flag=True).count()

    grades = {
        row["fused_grade"]: row["count"]
        for row in clusters.values("fused_grade").annotate(count=Count("id"))
    }
    coverage = {
        "image": clusters.filter(has_image=True).count(),
        "audio": clusters.filter(has_audio=True).count(),
        "edna": clusters.filter(has_edna=True).count(),
    }
    protected_levels = {"national_1", "national_2", "provincial"}
    pending_protected = clusters.filter(
        status=EvidenceCluster.Status.PENDING,
        species__protection_level__in=protected_levels,
    ).count()

    edna_total = EdnaEvidence.objects.count()
    edna_positive = EdnaEvidence.objects.filter(result=EdnaEvidence.Result.POSITIVE).count()

    return {
        "total": total,
        "pending": pending,
        "confirmed": confirmed,
        "rejected": rejected,
        "multiModal": multi_modal,
        "conflict": conflict,
        "pendingProtected": pending_protected,
        "grades": {
            "strong": grades.get(EvidenceCluster.Grade.STRONG, 0),
            "moderate": grades.get(EvidenceCluster.Grade.MODERATE, 0),
            "weak": grades.get(EvidenceCluster.Grade.WEAK, 0),
            "conflict": grades.get(EvidenceCluster.Grade.CONFLICT, 0),
            "insufficient": grades.get(EvidenceCluster.Grade.INSUFFICIENT, 0),
        },
        "coverage": coverage,
        "edna": {
            "total": edna_total,
            "positive": edna_positive,
            "negative": edna_total - edna_positive,
        },
        "config": {
            "windowHours": _int("fusion_window_hours", 24),
            "minModalities": _int("fusion_min_modalities", 2),
            "confidenceThreshold": _float("fusion_confidence_threshold", 0.8),
            "reviewThreshold": _float("fusion_review_threshold", 0.6),
            "timeDecay": _bool("fusion_time_decay_enabled", True),
            "spatial": _bool("fusion_spatial_enabled", True),
            "negativeEdna": _bool("fusion_edna_negative_enabled", True),
            "reviewIntegration": _bool("fusion_review_integration_enabled", True),
        },
    }
