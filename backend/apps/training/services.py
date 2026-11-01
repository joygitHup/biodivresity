"""训练闭环业务逻辑：快照冻结、Mock 训练指标、报告生成、审批与发布门禁。"""
from __future__ import annotations

import hashlib
import html as html_lib
import os
import random
import shutil
import subprocess
import tempfile
from datetime import datetime

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils import timezone

from apps.records.models import TrainingSample
from apps.records.services import (
    HIGH_RISK_LEVELS,
    config_bool,
    config_float,
    config_value,
)

from .models import DatasetSnapshot, TrainingReport, TrainingRun

REPORT_DIR = "training_reports"

MEDIA_LABELS = dict(TrainingRun.MediaType.choices)
RUN_STATUS_LABELS = dict(TrainingRun.Status.choices)
REPORT_STATUS_LABELS = dict(TrainingReport.Status.choices)


# ── 配置辅助 ─────────────────────────────────────────────────

def approval_level() -> int:
    return 2 if (config_value("training_approval_level") or "single").strip().lower() == "dual" else 1


def reviewer_ids() -> list[int]:
    raw = (config_value("training_reviewer_ids") or "").strip()
    if not raw:
        return []
    ids = []
    for part in raw.replace("，", ",").split(","):
        part = part.strip()
        if part.isdigit():
            ids.append(int(part))
    return ids


def is_reviewer_allowed(user) -> bool:
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    role = getattr(user, "role", "")
    if role == "admin":
        return True
    ids = reviewer_ids()
    if ids:
        return user.id in ids
    return role in ("admin", "staff")


# ── 数据快照 ─────────────────────────────────────────────────

def create_snapshot(run: TrainingRun, actor=None) -> DatasetSnapshot:
    """冻结本次训练使用的样本集合，并按比例划分 train/val/test。"""
    filters = run.filters or {}
    qs = (
        TrainingSample.objects
        .filter(status__in=(TrainingSample.Status.READY, TrainingSample.Status.EXPORTED))
        .filter(label__isnull=False)
        .select_related("label", "record")
    )
    if run.media_type:
        qs = qs.filter(media_type=run.media_type)

    label_sources = filters.get("label_sources") or []
    if label_sources:
        qs = qs.filter(label_source__in=label_sources)
    min_confidence = filters.get("min_confidence")
    if min_confidence:
        qs = qs.filter(confidence__gte=float(min_confidence))
    if filters.get("exclude_quality"):
        qs = qs.exclude(quality_flag__gt="")

    samples = list(qs.order_by("id"))
    sample_ids = [s.id for s in samples]
    sample_hash = hashlib.sha256(",".join(str(i) for i in sample_ids).encode()).hexdigest() if sample_ids else ""

    ratios = (
        max(config_float("training_split_train", 0.7), 0.1),
        max(config_float("training_split_val", 0.15), 0.0),
        max(config_float("training_split_test", 0.15), 0.0),
    )
    total = len(samples)
    train_end = int(total * ratios[0])
    val_end = train_end + int(total * ratios[1])
    splits = []
    for idx, sample in enumerate(samples):
        split = "train" if idx < train_end else ("val" if idx < val_end else "test")
        splits.append(split)
        sample.split = split
    if samples:
        TrainingSample.objects.bulk_update(samples, ["split"], batch_size=500)

    class_map: dict[int, dict] = {}
    source_stats: dict[str, int] = {}
    protected_count = 0
    for sample, split in zip(samples, splits):
        label = sample.label
        entry = class_map.setdefault(label.id, {
            "id": label.id,
            "name": label.chinese_name,
            "latin": label.latin_name,
            "severity": label.severity,
            "count": 0,
            "train": 0,
            "val": 0,
            "test": 0,
        })
        entry["count"] += 1
        entry[split] = entry.get(split, 0) + 1
        source_stats[sample.label_source] = source_stats.get(sample.label_source, 0) + 1
        if label.severity in HIGH_RISK_LEVELS:
            protected_count += 1

    return DatasetSnapshot.objects.create(
        media_type=run.media_type,
        filters=filters,
        sample_ids=sample_ids,
        sample_count=total,
        class_count=len(class_map),
        train_count=len([s for s in splits if s == "train"]),
        val_count=len([s for s in splits if s == "val"]),
        test_count=len([s for s in splits if s == "test"]),
        class_stats=sorted(class_map.values(), key=lambda x: -x["count"]),
        source_stats={
            "counts": source_stats,
            "protected": protected_count,
        },
        sample_hash=sample_hash,
        frozen_by=actor,
        frozen_at=timezone.now(),
    )


# ── Mock 训练 ────────────────────────────────────────────────

def _seed(run: TrainingRun) -> int:
    base = f"{run.id}:{run.snapshot.sample_hash if run.snapshot else ''}"
    return int(hashlib.sha256(base.encode()).hexdigest()[:8], 16)


def simulate_metrics(run: TrainingRun) -> dict:
    """Mock 训练指标：基于快照确定性生成，便于反复验证闭环。"""
    snapshot = run.snapshot
    seed = _seed(run)
    rng = random.Random(seed)
    classes = (snapshot.class_stats if snapshot else []) or []
    total = sum(c.get("count", 0) for c in classes) or 1

    per_class = []
    weighted_correct = 0.0
    protected_support = 0
    protected_correct = 0.0
    worst = None
    for cls in classes:
        support = cls.get("count", 0)
        # 样本量越大越稳定；高风险病虫害略保守
        base = min(0.995, 0.80 + support / max(total, 1) * 0.15 + rng.random() * 0.06)
        recall = round(base, 4)
        precision = round(min(0.999, recall + rng.uniform(-0.05, 0.05)), 4)
        f1 = round(2 * precision * recall / (precision + recall), 4) if (precision + recall) else 0
        weighted_correct += recall * support
        is_protected = cls.get("severity") in HIGH_RISK_LEVELS
        if is_protected:
            protected_support += support
            protected_correct += recall * support
        per_class.append({
            "id": cls.get("id"),
            "name": cls.get("name"),
            "latin": cls.get("latin"),
            "support": support,
            "recall": recall,
            "precision": precision,
            "f1": f1,
            "severity": cls.get("severity"),
            "protected": is_protected,
        })
        if worst is None or recall < worst["recall"]:
            worst = per_class[-1]

    top1 = round(weighted_correct / total, 4) if total else 0.0
    top5 = round(min(0.999, top1 + 0.03 + rng.random() * 0.02), 4)
    macro_f1 = round(sum(c["f1"] for c in per_class) / len(per_class), 4) if per_class else 0.0
    protected_recall = round(protected_correct / protected_support, 4) if protected_support else 1.0
    map50 = round(min(0.99, top1 * 0.92 + rng.uniform(0, 0.03)), 4)
    false_positive_rate = round(max(0.0, min(0.2, 0.02 + rng.uniform(0, 0.05))), 4)

    # 混淆矩阵：最长混淆的类别对
    names = [c["name"] for c in per_class]
    confusions = []
    if len(names) >= 2:
        for _ in range(min(8, len(names) - 1)):
            a, b = rng.sample(names, 2)
            confusions.append({
                "true": a,
                "predicted": b,
                "count": rng.randint(1, 5),
                "rate": round(rng.uniform(0.005, 0.05), 4),
            })

    failures = _failure_samples(run, per_class, rng)

    return {
        "top1_accuracy": top1,
        "top5_accuracy": top5,
        "macro_f1": macro_f1,
        "map50": map50,
        "protected_recall": protected_recall,
        "false_positive_rate": false_positive_rate,
        "per_class": per_class,
        "confusion_matrix": confusions,
        "failure_samples": failures,
        "worst_class": worst,
        "train_samples": snapshot.train_count if snapshot else 0,
        "val_samples": snapshot.val_count if snapshot else 0,
        "test_samples": snapshot.test_count if snapshot else 0,
        "epochs": int((run.hyperparams or {}).get("epochs") or 30),
        "provider": (config_value("training_provider_type") or "mock").strip() or "mock",
        "is_mock": (config_value("training_provider_type") or "mock").strip() != "http",
        "generated_at": timezone.now().isoformat(),
    }


def _failure_samples(run: TrainingRun, per_class: list[dict], rng: random.Random) -> list[dict]:
    """从测试集抽样构造错分样本，供报告做失败案例分析。"""
    if not run.snapshot:
        return []
    sample_ids = run.snapshot.sample_ids or []
    if not sample_ids:
        return []
    test_candidates = list(
        TrainingSample.objects
        .filter(id__in=sample_ids[-max(5, len(sample_ids) // 5):])
        .select_related("label", "record")
        .order_by("id")[:10]
    )
    names = [c["name"] for c in per_class]
    failures = []
    for sample in test_candidates:
        label_name = sample.label.chinese_name if sample.label else ""
        predicted = rng.choice([n for n in names if n != label_name] or [label_name])
        failures.append({
            "sample_id": sample.id,
            "record_id": sample.record_id,
            "media_url": sample.record.media_url if sample.record else "",
            "quality_flag": sample.quality_flag,
            "label": label_name,
            "predicted": predicted,
            "confidence": round(rng.uniform(0.35, 0.75), 4),
        })
    return failures


# ── 质量门禁 ─────────────────────────────────────────────────

def evaluate_quality_gate(metrics: dict) -> dict:
    enabled = config_bool("training_quality_gate_enabled", True)
    min_map = config_float("training_gate_min_map", 0.5)
    min_protected = config_float("training_gate_protected_recall", 0.9)
    has_protected = bool((metrics.get("per_class") or []) and any(c.get("protected") for c in metrics["per_class"]))
    checks = [
        {
            "key": "map50",
            "label": "整体精度(mAP)",
            "value": metrics.get("map50", 0),
            "threshold": min_map,
            "passed": metrics.get("map50", 0) >= min_map,
        },
        {
            "key": "protected_recall",
            "label": "高风险病虫害召回率",
            "value": metrics.get("protected_recall", 0),
            "threshold": min_protected,
            "passed": (not has_protected) or metrics.get("protected_recall", 0) >= min_protected,
        },
        {
            "key": "false_positive_rate",
            "label": "误报率",
            "value": metrics.get("false_positive_rate", 0),
            "threshold": 0.1,
            "passed": metrics.get("false_positive_rate", 0) <= 0.1,
        },
    ]
    passed = all(c["passed"] for c in checks) or not enabled
    return {
        "enabled": enabled,
        "passed": passed,
        "checks": checks,
        "has_protected": has_protected,
    }


def _baseline_metrics(run: TrainingRun) -> dict:
    if not config_bool("training_compare_baseline", True):
        return {}
    from apps.models_app.models import ModelVersion

    task_type = "audio" if run.media_type == TrainingRun.MediaType.AUDIO else "image"
    baseline = ModelVersion.objects.filter(
        status=ModelVersion.Status.ACTIVE, task_type=task_type,
    ).order_by("-created_at").first()
    if baseline is None:
        return {}
    return {
        "version": baseline.version,
        "name": baseline.name,
        "top1_accuracy": (baseline.top1_accuracy or 0) / 100,
        "top5_accuracy": (baseline.top5_accuracy or 0) / 100,
        "reject_rate": baseline.reject_rate,
    }


def build_comparison(run: TrainingRun, metrics: dict) -> dict:
    baseline = _baseline_metrics(run)
    if not baseline:
        return {"available": False}
    return {
        "available": True,
        "baseline": baseline,
        "delta_top1": round(metrics.get("top1_accuracy", 0) - baseline.get("top1_accuracy", 0), 4),
        "delta_top5": round(metrics.get("top5_accuracy", 0) - baseline.get("top5_accuracy", 0), 4),
    }


# ── 报告生成 ─────────────────────────────────────────────────

def _fmt_pct(value) -> str:
    try:
        return f"{float(value) * 100:.2f}%"
    except (TypeError, ValueError):
        return "—"


def _esc(value) -> str:
    return html_lib.escape("" if value is None else str(value))


def build_report_html(run: TrainingRun, report: TrainingReport) -> str:
    snapshot = run.snapshot
    metrics = report.metrics or {}
    gate = report.quality_gate or {}
    comparison = report.comparison or {}

    rows = ""
    for cls in metrics.get("per_class") or []:
        rows += (
            "<tr>"
            f"<td>{_esc(cls.get('name'))}</td>"
            f"<td class='muted'>{_esc(cls.get('latin'))}</td>"
            f"<td>{cls.get('support', 0)}</td>"
            f"<td>{_fmt_pct(cls.get('recall'))}</td>"
            f"<td>{_fmt_pct(cls.get('precision'))}</td>"
            f"<td>{_fmt_pct(cls.get('f1'))}</td>"
            f"<td>{'高风险' if cls.get('protected') else '—'}</td>"
            "</tr>"
        )

    cm_rows = "".join(
        "<tr>"
        f"<td>{_esc(cm.get('true'))}</td>"
        f"<td>{_esc(cm.get('predicted'))}</td>"
        f"<td>{cm.get('count', 0)}</td>"
        f"<td>{_fmt_pct(cm.get('rate'))}</td>"
        "</tr>"
        for cm in (metrics.get("confusion_matrix") or [])
    ) or "<tr><td colspan='4' class='muted'>无显著混淆</td></tr>"

    fail_rows = "".join(
        "<tr>"
        f"<td>#{fail.get('record_id')}</td>"
        f"<td>{_esc(fail.get('label'))}</td>"
        f"<td>{_esc(fail.get('predicted'))}</td>"
        f"<td>{_fmt_pct(fail.get('confidence'))}</td>"
        f"<td>{_esc(fail.get('quality_flag') or '—')}</td>"
        "</tr>"
        for fail in (metrics.get("failure_samples") or [])
    ) or "<tr><td colspan='5' class='muted'>无失败样本</td></tr>"

    gate_rows = "".join(
        "<tr>"
        f"<td>{_esc(c.get('label'))}</td>"
        f"<td>{_fmt_pct(c.get('value'))}</td>"
        f"<td>{_fmt_pct(c.get('threshold'))}</td>"
        f"<td>{'通过' if c.get('passed') else '未通过'}</td>"
        "</tr>"
        for c in (gate.get("checks") or [])
    )

    if comparison.get("available"):
        base = comparison.get("baseline") or {}
        compare_html = (
            "<table><thead><tr><th>指标</th><th>本次</th><th>线上版本 "
            f"{_esc(base.get('version'))}</th><th>差值</th></tr></thead><tbody>"
            f"<tr><td>Top-1 准确率</td><td>{_fmt_pct(metrics.get('top1_accuracy'))}</td>"
            f"<td>{_fmt_pct(base.get('top1_accuracy'))}</td>"
            f"<td>{_fmt_pct(comparison.get('delta_top1'))}</td></tr>"
            f"<tr><td>Top-5 准确率</td><td>{_fmt_pct(metrics.get('top5_accuracy'))}</td>"
            f"<td>{_fmt_pct(base.get('top5_accuracy'))}</td>"
            f"<td>{_fmt_pct(comparison.get('delta_top5'))}</td></tr>"
            "</tbody></table>"
        )
    else:
        compare_html = "<p class='muted'>当前无可对比的线上版本，首次训练不参与对比。</p>"

    status_label = REPORT_STATUS_LABELS.get(report.status, report.status)
    approval_html = (
        "<ul class='approval'>"
        f"<li>提交人：{_esc(getattr(report.submitted_by, 'username', '') or '—')} "
        f"{_esc(report.submitted_at.strftime('%Y-%m-%d %H:%M') if report.submitted_at else '')}</li>"
        f"<li>一级审核：{_esc(getattr(report.reviewed_by, 'username', '') or '—')} "
        f"{_esc(report.review_comment or '')}</li>"
        f"<li>终审：{_esc(getattr(report.approved_by, 'username', '') or '—')} "
        f"{_esc(report.approval_comment or '')}</li>"
        "</ul>"
    )

    source_counts = (snapshot.source_stats or {}).get("counts", {}) if snapshot else {}
    source_html = " ".join(
        f"<span class='pill'>{_esc(k)}: {v}</span>" for k, v in source_counts.items()
    ) or "<span class='muted'>—</span>"

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>训练结果报告 · 训练#{run.id} · r{report.revision}</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; padding: 32px; font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
         color: #1f2937; background: #f8faf9; }}
  .wrap {{ max-width: 1080px; margin: 0 auto; background: #fff; border-radius: 16px;
          box-shadow: 0 8px 24px rgba(6,78,59,.08); padding: 40px; }}
  h1 {{ font-size: 26px; margin: 0 0 6px; color: #065f46; }}
  h2 {{ font-size: 17px; margin: 32px 0 12px; padding-left: 10px; border-left: 4px solid #059669; color: #065f46; }}
  .meta {{ color: #6b7280; font-size: 13px; display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 8px; }}
  .status {{ display:inline-block; padding: 4px 12px; border-radius: 999px; font-size: 13px;
            background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; }}
  .status.warn {{ background:#fffbeb; color:#b45309; border-color:#fde68a; }}
  .status.bad {{ background:#fef2f2; color:#b91c1c; border-color:#fecaca; }}
  .grid {{ display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }}
  .card {{ border:1px solid #e5e7eb; border-radius:12px; padding:14px 16px; background:#fafaf9; }}
  .card .label {{ font-size:12px; color:#6b7280; }}
  .card .value {{ font-size:20px; font-weight:600; color:#065f46; margin-top:4px; }}
  table {{ width:100%; border-collapse: collapse; font-size: 13px; }}
  th, td {{ border-bottom:1px solid #eef2f1; padding:8px 10px; text-align:left; }}
  th {{ background:#f3faf7; color:#065f46; font-weight:600; }}
  .muted {{ color:#9ca3af; }}
  .pill {{ display:inline-block; background:#f3f4f6; border-radius:999px; padding:2px 10px; margin:0 6px 6px 0; font-size:12px; }}
  .approval {{ margin:0; padding-left:18px; color:#374151; font-size:13px; line-height:1.9; }}
  .note {{ font-size:12px; color:#6b7280; background:#f9fafb; border-radius:10px; padding:12px 14px; margin-top:24px; }}
</style>
</head>
<body>
<div class="wrap">
  <h1>训练结果报告</h1>
  <div class="meta">
    <span>训练任务 #{run.id}</span>
    <span>模态：{_esc(MEDIA_LABELS.get(run.media_type, run.media_type))}</span>
    <span>模型族：{_esc(run.model_family)}</span>
    <span>报告版本 r{report.revision}</span>
    <span>生成时间：{_esc(report.generated_at.strftime('%Y-%m-%d %H:%M') if report.generated_at else '')}</span>
    <span class="status {'warn' if report.status not in ('approved',) else ''}">{_esc(status_label)}</span>
  </div>

  <h2>一、数据快照</h2>
  <div class="grid">
    <div class="card"><div class="label">样本总数</div><div class="value">{snapshot.sample_count if snapshot else 0}</div></div>
    <div class="card"><div class="label">类别数</div><div class="value">{snapshot.class_count if snapshot else 0}</div></div>
    <div class="card"><div class="label">训练 / 验证 / 测试</div>
      <div class="value" style="font-size:15px">{snapshot.train_count if snapshot else 0} / {snapshot.val_count if snapshot else 0} / {snapshot.test_count if snapshot else 0}</div></div>
    <div class="card"><div class="label">高风险类别样本</div><div class="value">{(snapshot.source_stats or {}).get('protected', 0) if snapshot else 0}</div></div>
  </div>
  <p class="muted" style="font-size:12px;margin-top:10px">快照哈希：{_esc(snapshot.sample_hash if snapshot else '')}</p>
  <p><strong>标签来源：</strong>{source_html}</p>

  <h2>二、核心指标</h2>
  <div class="grid">
    <div class="card"><div class="label">Top-1 准确率</div><div class="value">{_fmt_pct(metrics.get('top1_accuracy'))}</div></div>
    <div class="card"><div class="label">Top-5 准确率</div><div class="value">{_fmt_pct(metrics.get('top5_accuracy'))}</div></div>
    <div class="card"><div class="label">mAP@0.5</div><div class="value">{_fmt_pct(metrics.get('map50'))}</div></div>
    <div class="card"><div class="label">Macro F1</div><div class="value">{_fmt_pct(metrics.get('macro_f1'))}</div></div>
    <div class="card"><div class="label">高风险病虫害召回率</div><div class="value">{_fmt_pct(metrics.get('protected_recall'))}</div></div>
    <div class="card"><div class="label">误报率</div><div class="value">{_fmt_pct(metrics.get('false_positive_rate'))}</div></div>
  </div>

  <h2>三、质量门禁</h2>
  <p>{'门禁校验通过，可提交审批' if gate.get('passed') else '门禁校验未通过，建议补充数据或调整训练配置'}</p>
  <table><thead><tr><th>检查项</th><th>实际值</th><th>阈值</th><th>结果</th></tr></thead>
  <tbody>{gate_rows or "<tr><td colspan='4' class='muted'>未启用门禁</td></tr>"}</tbody></table>

  <h2>四、与线上版本对比</h2>
  {compare_html}

  <h2>五、逐类指标</h2>
  <table><thead><tr><th>类别</th><th>学名</th><th>样本数</th><th>召回率</th><th>精确率</th><th>F1</th><th>危害等级</th></tr></thead>
  <tbody>{rows or "<tr><td colspan='7' class='muted'>无类别数据</td></tr>"}</tbody></table>

  <h2>六、混淆矩阵摘要</h2>
  <table><thead><tr><th>真实类别</th><th>预测类别</th><th>样本数</th><th>占比</th></tr></thead>
  <tbody>{cm_rows}</tbody></table>

  <h2>七、失败样本分析</h2>
  <table><thead><tr><th>记录</th><th>真实标签</th><th>预测</th><th>置信度</th><th>质量标记</th></tr></thead>
  <tbody>{fail_rows}</tbody></table>

  <h2>八、结论</h2>
  <p>{_esc(report.conclusion or '')}</p>

  <h2>九、审批记录</h2>
  {approval_html}

  <h2>十、说明</h2>
  <div class="note">
    本报告由系统自动生成。当前训练后端为
    <strong>{_esc(metrics.get('provider', 'mock'))}</strong>
    {'（Mock 模拟指标，仅用于验证训练闭环与审批流程；接入真实训练服务后指标将替换为实测结果）' if metrics.get('is_mock') else ''}。
    报告审批通过前，该模型版本不得进入灰度发布或上线。
  </div>
</div>
</body>
</html>"""


def _save_report_file(name: str, content: bytes) -> str:
    if default_storage.exists(name):
        default_storage.delete(name)
    return default_storage.save(name, ContentFile(content))


def generate_report(run: TrainingRun) -> TrainingReport:
    """生成一版训练报告（HTML + 可选 PDF），状态为 report_ready。"""
    metrics = run.metrics or {}
    report = TrainingReport.objects.filter(run=run).order_by("-revision").first()
    revision = (report.revision + 1) if report else 1
    gate = evaluate_quality_gate(metrics)
    comparison = build_comparison(run, metrics)

    worst = metrics.get("worst_class") or {}
    conclusion = (
        f"本次训练使用 {run.snapshot.sample_count if run.snapshot else 0} 条样本、"
        f"{run.snapshot.class_count if run.snapshot else 0} 个类别，"
        f"Top-1 {_fmt_pct(metrics.get('top1_accuracy'))}，"
        f"高风险病虫害召回率 {_fmt_pct(metrics.get('protected_recall'))}。"
    )
    if worst:
        conclusion += f"表现最差类别为 {worst.get('name')}（召回率 {_fmt_pct(worst.get('recall'))}）。"
    if gate.get("passed"):
        conclusion += "质量门禁校验通过。"
    else:
        failed = [c["label"] for c in gate.get("checks", []) if not c.get("passed")]
        conclusion += f"质量门禁未通过：{'、'.join(failed)}。"
    if comparison.get("available"):
        conclusion += f"相较线上版本 Top-1 变化 {_fmt_pct(comparison.get('delta_top1'))}。"

    report = TrainingReport.objects.create(
        run=run,
        revision=revision,
        status=TrainingReport.Status.REPORT_READY,
        approval_level=approval_level(),
        metrics=metrics,
        comparison=comparison,
        quality_gate=gate,
        conclusion=conclusion,
        submitted_by=run.submitted_by,
        generated_at=timezone.now(),
    )

    html_content = build_report_html(run, report)
    html_name = f"{REPORT_DIR}/run_{run.id}/report_r{revision}.html"
    report.html_path = _save_report_file(html_name, html_content.encode("utf-8"))
    pdf_path = generate_pdf(report, html_content)
    if pdf_path:
        report.pdf_path = pdf_path
    report.save(update_fields=["html_path", "pdf_path"])
    return report


BROWSER_CANDIDATES = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
]


def _find_browser() -> str | None:
    env_path = os.environ.get("TRAINING_PDF_BROWSER", "").strip()
    if env_path and os.path.exists(env_path):
        return env_path
    for path in BROWSER_CANDIDATES:
        if os.path.exists(path):
            return path
    for name in ("msedge", "chrome", "google-chrome", "chromium"):
        found = shutil.which(name)
        if found:
            return found
    return None


def generate_pdf(report: TrainingReport, html_content: str | None = None) -> str:
    """用系统 Edge/Chrome 无头模式打印 PDF；失败时降级为空（仅保留 HTML）。"""
    if not config_bool("training_pdf_enabled", True):
        return ""
    browser = _find_browser()
    if not browser:
        return ""
    if html_content is None:
        try:
            with default_storage.open(report.html_path, "rb") as fh:
                html_content = fh.read().decode("utf-8")
        except Exception:
            return ""

    tmp_dir = tempfile.mkdtemp(prefix="training-pdf-")
    html_file = os.path.join(tmp_dir, "report.html")
    pdf_file = os.path.join(tmp_dir, "report.pdf")
    try:
        with open(html_file, "w", encoding="utf-8") as fh:
            fh.write(html_content)
        subprocess.run(
            [
                browser,
                "--headless",
                "--disable-gpu",
                "--no-sandbox",
                f"--print-to-pdf={pdf_file}",
                "--no-pdf-header-footer",
                f"file:///{html_file.replace(os.sep, '/').lstrip('/')}",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=90,
        )
        if not os.path.exists(pdf_file) or os.path.getsize(pdf_file) == 0:
            return ""
        with open(pdf_file, "rb") as fh:
            content = fh.read()
        name = f"{REPORT_DIR}/run_{report.run_id}/report_r{report.revision}.pdf"
        return _save_report_file(name, content)
    except Exception:
        return ""
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ── 发布门禁 ─────────────────────────────────────────────────

def publish_gate_error(model_version) -> str | None:
    """模型灰度/上线前的报告门禁校验，返回错误信息或 None。"""
    if not config_bool("training_report_required", True):
        return None
    run = model_version.training_run
    if run is None:
        return None  # 手工注册的模型不受训练报告门禁限制
    report = model_version.training_report or run.latest_report
    if report is None:
        return "该模型由训练任务产生，但尚未生成训练报告"
    latest = run.latest_report
    if latest and report.id != latest.id:
        return "训练报告已更新，请使用最新报告完成审批后再发布"
    from apps.models_app.models import ModelVersion

    if report.status != TrainingReport.Status.APPROVED:
        label = REPORT_STATUS_LABELS.get(report.status, report.status)
        return f"训练报告尚未审批通过（当前：{label}），不允许灰度或上线"
    if model_version.approval_status != ModelVersion.ApprovalStatus.APPROVED:
        return "模型版本的报告审批状态未同步为已通过，请重新确认报告的审批结果"
    return None


# ── 审批流程 ─────────────────────────────────────────────────

def submit_report(report: TrainingReport, actor, remark: str = "") -> TrainingReport:
    if report.status not in (TrainingReport.Status.REPORT_READY, TrainingReport.Status.REJECTED):
        raise ValueError("当前报告状态不允许提交审批")
    report.status = TrainingReport.Status.PENDING_REVIEW
    report.approval_level = approval_level()
    report.submitted_by = actor or report.submitted_by
    report.submitted_at = timezone.now()
    report.reviewed_by = None
    report.reviewed_at = None
    report.review_comment = remark
    report.approved_by = None
    report.approved_at = None
    report.approval_comment = ""
    report.save()
    _sync_model_status(report, "pending")
    _notify(
        "训练报告待审批",
        f"训练任务 #{report.run_id} 的报告 r{report.revision} 已提交，等待审核。",
        f"training:report:{report.id}:submitted",
    )
    return report


def review_report(report: TrainingReport, actor, comment: str = "") -> TrainingReport:
    if report.status != TrainingReport.Status.PENDING_REVIEW:
        raise ValueError("报告不在待一级审核状态")
    if report.submitted_by_id and report.submitted_by_id == getattr(actor, "id", None):
        raise ValueError("提交人不能审批自己的训练报告")
    if not is_reviewer_allowed(actor):
        raise PermissionError("当前用户不在训练报告审批人范围内")
    report.reviewed_by = actor
    report.reviewed_at = timezone.now()
    report.review_comment = comment
    if report.approval_level >= 2:
        report.status = TrainingReport.Status.PENDING_FINAL
        report.save()
        _notify(
            "训练报告待终审",
            f"训练任务 #{report.run_id} 的报告 r{report.revision} 已通过一级审核，等待终审。",
            f"training:report:{report.id}:final",
        )
    else:
        _final_approve(report, actor, comment)
    return report


def final_approve_report(report: TrainingReport, actor, comment: str = "") -> TrainingReport:
    if report.status != TrainingReport.Status.PENDING_FINAL:
        raise ValueError("报告不在待终审状态")
    if report.submitted_by_id and report.submitted_by_id == getattr(actor, "id", None):
        raise ValueError("提交人不能审批自己的训练报告")
    if not is_reviewer_allowed(actor):
        raise PermissionError("当前用户不在训练报告审批人范围内")
    _final_approve(report, actor, comment)
    return report


def reject_report(report: TrainingReport, actor, comment: str = "") -> TrainingReport:
    if report.status not in (TrainingReport.Status.PENDING_REVIEW, TrainingReport.Status.PENDING_FINAL):
        raise ValueError("当前报告状态不可驳回")
    if not is_reviewer_allowed(actor):
        raise PermissionError("当前用户不在训练报告审批人范围内")
    previous = report.status
    report.status = TrainingReport.Status.REJECTED
    if previous == TrainingReport.Status.PENDING_REVIEW:
        report.review_comment = comment
    else:
        report.approval_comment = comment
    report.reviewed_by = report.reviewed_by or actor
    report.reviewed_at = report.reviewed_at or timezone.now()
    report.save()
    _sync_model_status(report, "rejected")
    _notify(
        "训练报告被驳回",
        f"训练任务 #{report.run_id} 的报告 r{report.revision} 被驳回：{comment or '未填写原因'}",
        f"training:report:{report.id}:rejected",
    )
    return report


def _final_approve(report: TrainingReport, actor, comment: str) -> None:
    report.status = TrainingReport.Status.APPROVED
    report.approved_by = actor
    report.approved_at = timezone.now()
    report.approval_comment = comment or report.review_comment
    report.save()
    _sync_model_status(report, "approved", actor)
    _notify(
        "训练报告已通过",
        f"训练任务 #{report.run_id} 的报告 r{report.revision} 审批通过，可进行灰度或上线。",
        f"training:report:{report.id}:approved",
    )


def _sync_model_status(report: TrainingReport, status: str, actor=None) -> None:
    """同步训练产出的模型版本审批状态，供发布门禁校验。"""
    from apps.models_app.models import ModelVersion

    qs = ModelVersion.objects.filter(training_run=report.run)
    if status == "approved":
        qs.update(
            approval_status=ModelVersion.ApprovalStatus.APPROVED,
            approved_by=actor,
            approved_at=timezone.now(),
            training_report=report,
        )
    elif status == "rejected":
        qs.update(
            approval_status=ModelVersion.ApprovalStatus.REJECTED,
            approved_by=None,
            approved_at=None,
            training_report=report,
        )
    else:
        qs.update(
            approval_status=ModelVersion.ApprovalStatus.PENDING,
            training_report=report,
        )


def _notify(title: str, description: str, ref: str) -> None:
    try:
        from apps.alerts.models import Alert

        Alert.objects.get_or_create(
            source_ref=ref,
            defaults={
                "type": Alert.Type.TRAINING_APPROVAL,
                "level": Alert.Level.INFO,
                "title": title[:200],
                "description": description,
                "source": Alert.Source.TRAINING,
            },
        )
    except Exception:
        pass


# ── 模型版本登记 ─────────────────────────────────────────────

def register_model_version(run: TrainingRun, report: TrainingReport):
    """训练成功后自动登记一个草稿模型版本，并挂接训练任务与报告。"""
    if not config_bool("training_auto_register_model", True):
        return None
    from apps.models_app.models import ModelVersion

    suffix = datetime.now().strftime("%m%d%H%M")
    task_type = "audio" if run.media_type == TrainingRun.MediaType.AUDIO else "image"
    metrics = run.metrics or {}
    model = ModelVersion.objects.create(
        version=f"train-{run.id}-{suffix}",
        name=f"训练模型 {MEDIA_LABELS.get(run.media_type, run.media_type)} #{run.id}",
        file_path=run.artifact,
        top1_accuracy=round((metrics.get("top1_accuracy") or 0) * 100, 2),
        top5_accuracy=round((metrics.get("top5_accuracy") or 0) * 100, 2),
        status=ModelVersion.Status.DRAFT,
        task_type=task_type,
        description=f"由训练任务 #{run.id} 自动登记，报告 r{report.revision}，审批通过前不可发布。",
        training_run=run,
        training_report=report,
        approval_status=ModelVersion.ApprovalStatus.PENDING,
    )
    run.target_model_version = model
    run.save(update_fields=["target_model_version"])
    return model


def report_stats() -> dict:
    pending = TrainingReport.objects.filter(
        status__in=(TrainingReport.Status.PENDING_REVIEW, TrainingReport.Status.PENDING_FINAL),
    ).count()
    return {
        "pendingReports": pending,
        "totalReports": TrainingReport.objects.count(),
        "approvedReports": TrainingReport.objects.filter(status=TrainingReport.Status.APPROVED).count(),
        "rejectedReports": TrainingReport.objects.filter(status=TrainingReport.Status.REJECTED).count(),
    }


def serialize_report(report: TrainingReport, user=None) -> dict:
    approval = approval_level()
    status_map = {
        "approved": "已通过",
        "rejected": "已驳回",
        "pending_review": "待一级审核",
        "pending_final": "待终审",
        "report_ready": "报告已生成",
    }
    return {
        "id": report.id,
        "runId": report.run_id,
        "revision": report.revision,
        "status": report.status,
        "statusLabel": status_map.get(report.status, report.status),
        "approvalLevel": approval,
        "metrics": report.metrics,
        "comparison": report.comparison,
        "qualityGate": report.quality_gate,
        "conclusion": report.conclusion,
        "hasHtml": bool(report.html_path),
        "hasPdf": bool(report.pdf_path),
        "generatedAt": report.generated_at,
        "submittedBy": getattr(report.submitted_by, "username", ""),
        "submittedById": report.submitted_by_id,
        "submittedAt": report.submitted_at,
        "reviewedBy": getattr(report.reviewed_by, "username", ""),
        "reviewedAt": report.reviewed_at,
        "reviewComment": report.review_comment,
        "approvedBy": getattr(report.approved_by, "username", ""),
        "approvedAt": report.approved_at,
        "approvalComment": report.approval_comment,
        "canSubmit": report.status in (TrainingReport.Status.REPORT_READY, TrainingReport.Status.REJECTED),
        "canReview": (
            report.status == TrainingReport.Status.PENDING_REVIEW
            and user is not None
            and getattr(user, "id", None) != report.submitted_by_id
            and is_reviewer_allowed(user)
        ),
        "canApprove": (
            report.status == TrainingReport.Status.PENDING_FINAL
            and user is not None
            and getattr(user, "id", None) != report.submitted_by_id
            and is_reviewer_allowed(user)
        ),
        "canReject": (
            report.status in (TrainingReport.Status.PENDING_REVIEW, TrainingReport.Status.PENDING_FINAL)
            and is_reviewer_allowed(user)
        ),
        "isSubmitter": user is not None and getattr(user, "id", None) == report.submitted_by_id,
    }
