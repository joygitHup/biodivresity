"""System config model — key-value store with code-level defaults."""
from django.db import models


class SystemConfig(models.Model):
    """系统配置项，键值对存储；未落库的配置项由代码提供默认值。"""

    key = models.CharField(max_length=64, unique=True, verbose_name="配置键")
    value = models.CharField(max_length=255, verbose_name="配置值")
    description = models.CharField(max_length=255, blank=True, verbose_name="说明")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        db_table = "system_config"
        verbose_name = "系统配置"
        verbose_name_plural = "系统配置"

    def __str__(self):
        return f"{self.key}={self.value}"


# 支持的配置项及默认值（未落库时返回默认值）
CONFIG_DEFAULTS = {
    # 安全设置
    "two_factor_auth": {"default": "false", "description": "双因素认证"},
    "data_masking": {"default": "true", "description": "敏感数据脱敏"},
    # 数据管理
    "auto_backup": {"default": "true", "description": "自动备份"},
    "raw_retention_months": {"default": "3", "description": "原始文件保留月数"},
    # AI识别配置
    "review_threshold": {"default": "0.6", "description": "人工复核置信度阈值"},
    "review_threshold_protected": {"default": "0.8", "description": "保护物种复核阈值"},
    "review_threshold_common": {"default": "0.6", "description": "常见物种复核阈值"},
    "anomaly_threshold": {"default": "500", "description": "单设备单日触发次数上限"},
    "protection_alert_days": {"default": "30", "description": "保护物种异常周期(天)"},
    # 训练样本池与自动确认
    "auto_confirm_enabled": {"default": "true", "description": "高置信度记录自动确认(免人工复核)"},
    "auto_confirm_threshold": {"default": "0.9", "description": "自动确认置信度阈值"},
    "auto_confirm_skip_protected": {"default": "true", "description": "保护物种不自动确认"},
    "training_sample_enabled": {"default": "true", "description": "确认记录自动登记训练样本池"},
    "training_audio_enabled": {"default": "true", "description": "音频样本纳入训练池"},
    "training_video_enabled": {"default": "true", "description": "视频样本纳入训练池"},
    "video_frame_fps": {"default": "1", "description": "视频导出抽帧帧率(fps)"},
    # 模型训练与报告审批
    "training_enabled": {"default": "true", "description": "启用模型训练任务"},
    "training_provider_type": {"default": "mock", "description": "训练后端：mock(本地模拟) / http(远程训练服务)"},
    "training_min_samples": {"default": "20", "description": "发起训练的最少样本数"},
    "training_split_train": {"default": "0.7", "description": "训练集划分比例"},
    "training_split_val": {"default": "0.15", "description": "验证集划分比例"},
    "training_split_test": {"default": "0.15", "description": "测试集划分比例"},
    "training_report_required": {"default": "true", "description": "训练结果报告强制生成且审批通过才可发布"},
    "training_approval_level": {"default": "single", "description": "审批层级：single(单级) / dual(两级)"},
    "training_reviewer_ids": {"default": "", "description": "指定审批人用户ID(逗号分隔，留空表示管理员/农技人员均可)"},
    "training_force_manual_for_protected": {"default": "true", "description": "含保护/入侵物种的模型强制人工审批"},
    "training_retry_max": {"default": "3", "description": "训练失败自动重试次数上限"},
    "training_quality_gate_enabled": {"default": "true", "description": "启用报告质量门禁校验"},
    "training_gate_protected_recall": {"default": "0.9", "description": "质量门禁：保护物种召回率下限"},
    "training_gate_min_map": {"default": "0.5", "description": "质量门禁：mAP/准确率下限"},
    "training_pdf_enabled": {"default": "true", "description": "生成PDF版训练报告"},
    "training_compare_baseline": {"default": "true", "description": "报告与线上版本指标对比"},
    "training_auto_register_model": {"default": "true", "description": "训练完成后自动登记模型版本(草稿)"},
    # 两级调度配置（边缘轻量模型 + 云端大模型）
    "edge_enabled": {"default": "true", "description": "启用边缘先行调度"},
    "edge_scope": {"default": "device", "description": "边缘调度范围：device(仅边缘设备) / all(全部数据)"},
    "edge_accept_threshold": {"default": "0.85", "description": "边缘直判置信度阈值"},
    "edge_ambiguous_margin": {"default": "0.1", "description": "Top1与Top2最小置信度差，低于则上云"},
    "edge_protected_escalate": {"default": "true", "description": "保护物种强制上云"},
    "edge_quality_escalate": {"default": "true", "description": "质量异常强制上云"},
    "edge_fallback_to_cloud": {"default": "true", "description": "边缘异常时降级到云端"},
    "edge_cloud_daily_budget": {"default": "0", "description": "云端每日调用上限(0=不限)"},
    "edge_budget_accept_floor": {"default": "0.6", "description": "预算耗尽时边缘降级直判最低置信度"},
    "edge_protected_exceptions": {"default": "", "description": "保护物种强制上云例外(逗号分隔的物种ID，这些物种不强制上云)"},
    # 边缘 Provider 运行时配置（平台调用边缘推理服务时使用）
    "edge_provider_type": {"default": "mock", "description": "边缘推理后端：mock(本地模拟) / http(远程HTTP)"},
    "edge_http_url": {"default": "", "description": "边缘推理服务HTTP地址，如 http://edge-gw:8080"},
    "edge_http_token": {"default": "", "description": "边缘推理服务鉴权Token(可选)"},
    "edge_input_mode": {"default": "file", "description": "边缘服务文件传递方式：file(直传) / url(媒体URL) / path(本地路径)"},
    "edge_model_version": {"default": "edge-v0.4.0", "description": "边缘轻量模型版本号"},
    # 声学质量配置
    "audio_vad_backend": {"default": "energy", "description": "VAD后端：energy / silero"},
    "audio_vad_saturation_ratio": {"default": "0.3", "description": "VAD占比饱和阈值"},
    "audio_min_snr_db": {"default": "5", "description": "最低信噪比(dB)"},
    "audio_min_vad_ratio": {"default": "0.05", "description": "最低有效声段占比"},
    "audio_min_separation": {"default": "0.4", "description": "最低声源分离质量"},
    "audio_max_overlap": {"default": "0.6", "description": "最大声源重叠占比"},
    "audio_reliability_threshold": {"default": "0.5", "description": "可靠度分级下限"},
    "audio_degraded_threshold": {"default": "0.75", "description": "可靠等级分界"},
    "audio_separation_mode": {"default": "provider", "description": "分离质量来源：provider / http / local"},
    "audio_separation_endpoint": {"default": "", "description": "分离模型HTTP地址"},
    "audio_separation_model": {"default": "", "description": "本地分离模型路径"},
    # 跨模态证据融合配置
    "fusion_enabled": {"default": "true", "description": "启用跨模态证据融合"},
    "fusion_window_hours": {"default": "24", "description": "证据融合时间窗(小时)"},
    "fusion_rebuild_lookback_hours": {"default": "48", "description": "周期重建回溯小时数"},
    "fusion_min_modalities": {"default": "2", "description": "构成跨模态证据的最少模态数"},
    "fusion_confidence_threshold": {"default": "0.8", "description": "强证据融合置信度阈值"},
    "fusion_review_threshold": {"default": "0.6", "description": "中等证据融合置信度阈值"},
    "fusion_weight_image": {"default": "1.0", "description": "图像证据基础权重"},
    "fusion_weight_video": {"default": "1.0", "description": "视频证据基础权重"},
    "fusion_weight_audio": {"default": "0.9", "description": "声学证据基础权重"},
    "fusion_weight_edna": {"default": "1.0", "description": "eDNA证据基础权重"},
    "fusion_reliability_floor": {"default": "0.35", "description": "声学可靠度权重下限"},
    "fusion_min_evidence_reliability": {"default": "0.2", "description": "低于该可靠性的证据不参与融合"},
    "fusion_review_integration_enabled": {"default": "true", "description": "将人工复核结果纳入融合：驳回剔除、纠正改物种、确认提权"},
    "fusion_reviewed_boost": {"default": "1.2", "description": "已确认/已纠正记录的可靠性提升系数(上限1.0)"},
    "fusion_time_decay_enabled": {"default": "true", "description": "启用时间衰减"},
    "fusion_time_decay_half_life_hours": {"default": "24", "description": "时间衰减半衰期(小时)"},
    "fusion_spatial_enabled": {"default": "true", "description": "启用空间核降权"},
    "fusion_spatial_radius_km": {"default": "5", "description": "空间核半径(km)"},
    "fusion_edna_negative_enabled": {"default": "true", "description": "将eDNA阴性结果作为反向证据"},
    "fusion_negative_penalty": {"default": "0.5", "description": "eDNA阴性证据权重惩罚系数"},
    "fusion_conflict_detection_enabled": {"default": "true", "description": "启用跨物种冲突检测"},
    "fusion_conflict_margin": {"default": "0.2", "description": "冲突判定置信度差"},
    "fusion_rebuild_interval_minutes": {"default": "5", "description": "周期重建间隔(分钟)"},
    "fusion_auto_alert_enabled": {"default": "true", "description": "强证据自动生成预警"},
    "fusion_last_rebuild_at": {"default": "", "description": "最近一次融合重建时间（系统记录）"},
}


# ── 配置变更后失效缓存（见 common.config.get_config）──────────────────
from django.db.models.signals import post_delete, post_save  # noqa: E402
from django.dispatch import receiver  # noqa: E402


@receiver([post_save, post_delete], sender=SystemConfig)
def _invalidate_config_cache(sender, instance, **kwargs):
    from common.config import invalidate_config

    invalidate_config(instance.key)
