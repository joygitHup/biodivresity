"""声学质量评估：VAD、信噪比、重叠率与综合可靠度。

VAD 支持 energy（能量+过零率，默认）与 silero（语音 VAD，可选）两种后端，
阈值与权重支持系统配置（SystemConfig）动态调整，未配置时回退 settings。

音频解码顺序：soundfile（wav/flac/ogg/mp3）→ 标准库 wave → ffmpeg（m4a/aac 等）。
声源分离质量默认取推理服务返回值，预留 http / local 两种后端（见 separation.py）。
"""
from __future__ import annotations

import contextvars
import logging
import math
import os
import subprocess
import tempfile
import threading
import wave
from pathlib import Path

import numpy as np
from django.conf import settings

logger = logging.getLogger(__name__)

GRADE_RELIABLE = "reliable"
GRADE_DEGRADED = "degraded"
GRADE_UNRELIABLE = "unreliable"

FLAG_HIGH_NOISE = "high_noise"
FLAG_LOW_VAD = "low_vad"
FLAG_UNRELIABLE_SEPARATION = "unreliable_separation"
FLAG_OVERLAP_HEAVY = "overlap_heavy"
FLAG_AUDIO_UNRELIABLE = "audio_unreliable"
FLAG_AUDIO_DEGRADED = "audio_degraded"

# 各分量权重；缺失分量会重新归一化
QUALITY_WEIGHTS = {"vad": 0.35, "snr": 0.25, "separation": 0.25, "overlap": 0.15}

# settings 名称 → SystemConfig 键
_DB_KEY_MAP = {
    "AUDIO_VAD_BACKEND": "audio_vad_backend",
    "AUDIO_VAD_SATURATION_RATIO": "audio_vad_saturation_ratio",
    "AUDIO_MIN_SNR_DB": "audio_min_snr_db",
    "AUDIO_MIN_VAD_RATIO": "audio_min_vad_ratio",
    "AUDIO_MIN_SEPARATION": "audio_min_separation",
    "AUDIO_MAX_OVERLAP": "audio_max_overlap",
    "AUDIO_RELIABILITY_THRESHOLD": "audio_reliability_threshold",
    "AUDIO_DEGRADED_THRESHOLD": "audio_degraded_threshold",
    "AUDIO_SEPARATION_MODE": "audio_separation_mode",
    "AUDIO_SEPARATION_ENDPOINT": "audio_separation_endpoint",
    "AUDIO_SEPARATION_MODEL": "audio_separation_model",
}

_RUNTIME_CONFIG = contextvars.ContextVar("audio_quality_config", default=None)

_SILERO_MODEL = None
_SILERO_LOAD_FAILED = False
_SILERO_LOCK = threading.Lock()


def load_runtime_config() -> dict:
    """读取声学配置（带缓存）；未落库的键返回默认值，调用方回退 settings 也一致。"""
    try:
        from apps.system_config.models import CONFIG_DEFAULTS
        from common.config import get_config

        return {
            key: get_config(key)
            for key in CONFIG_DEFAULTS
            if key.startswith("audio_")
        }
    except Exception:  # 未迁移或数据库异常时回退 settings
        logger.debug("读取声学配置失败，使用 settings 默认值", exc_info=True)
        return {}


def _setting(name: str, default):
    runtime = _RUNTIME_CONFIG.get()
    db_key = _DB_KEY_MAP.get(name)
    if runtime and db_key and runtime.get(db_key) not in (None, ""):
        raw = runtime[db_key]
        try:
            if isinstance(default, bool):
                return str(raw).strip().lower() in ("1", "true", "yes", "on")
            if isinstance(default, int):
                return int(float(raw))
            if isinstance(default, float):
                return float(raw)
            return str(raw)
        except (TypeError, ValueError):
            logger.warning("配置项 %s 值非法: %r，回退默认值", db_key, raw)
    return getattr(settings, name, default)


def _ffmpeg_available() -> bool:
    ffmpeg = os.environ.get("FFMPEG_BINARY", "ffmpeg")
    try:
        subprocess.run([ffmpeg, "-version"], capture_output=True, timeout=5, check=True)
        return True
    except Exception:
        return False


def _read_wav(path: str) -> tuple[np.ndarray, int]:
    with wave.open(path, "rb") as fh:
        sample_rate = fh.getframerate()
        channels = fh.getnchannels()
        width = fh.getsampwidth()
        raw = fh.readframes(fh.getnframes())

    dtype = {1: np.int8, 2: np.int16, 4: np.int32}.get(width)
    if dtype is None:
        raise ValueError(f"不支持的采样位宽: {width}")
    samples = np.frombuffer(raw, dtype=dtype).astype(np.float32)
    samples /= float(np.iinfo(dtype).max)
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    return samples, sample_rate


def _load_with_ffmpeg(path: str) -> tuple[np.ndarray, int]:
    """用 ffmpeg 解码 m4a/aac/amr 等 soundfile 不支持的格式。"""
    if not _ffmpeg_available():
        raise ValueError("ffmpeg 不可用，无法解码该音频格式")
    fd, tmp_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        ffmpeg = os.environ.get("FFMPEG_BINARY", "ffmpeg")
        proc = subprocess.run(
            [ffmpeg, "-v", "error", "-y", "-i", path, "-ac", "1", "-ar", "16000",
             "-sample_fmt", "s16", tmp_path],
            capture_output=True, timeout=60,
        )
        if proc.returncode != 0:
            raise ValueError(f"ffmpeg 解码失败: {proc.stderr.decode('utf-8', 'ignore')[:200]}")
        return _read_wav(tmp_path)
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


def _load_audio(path: str) -> tuple[np.ndarray, int]:
    """优先 soundfile（wav/flac/ogg/mp3），其次 wave，最后 ffmpeg。"""
    try:
        import soundfile as sf

        data, sample_rate = sf.read(path, dtype="float32", always_2d=True)
        return data.mean(axis=1), int(sample_rate)
    except Exception:
        logger.debug("soundfile 解码失败，尝试回退", exc_info=True)

    try:
        return _read_wav(path)
    except Exception:
        return _load_with_ffmpeg(path)


def _frame_metrics(samples: np.ndarray, sample_rate: int) -> tuple[np.ndarray, np.ndarray, int, int]:
    """用前缀和计算逐帧 RMS 与过零率，避免滑动窗口占用大内存。"""
    frame_len = max(int(sample_rate * _setting("AUDIO_FRAME_MS", 25) / 1000), 1)
    hop = max(int(sample_rate * _setting("AUDIO_HOP_MS", 10) / 1000), 1)
    if samples.size < frame_len:
        return (
            np.array([float(np.sqrt(np.mean(samples ** 2)))]) if samples.size else np.array([]),
            np.array([0.0]),
            frame_len,
            hop,
        )

    power = samples ** 2
    cumsum = np.concatenate(([0.0], np.cumsum(power, dtype=np.float64)))
    mean_power = (cumsum[frame_len:] - cumsum[:-frame_len]) / frame_len
    rms = np.sqrt(mean_power)[::hop]

    signs = np.signbit(samples).astype(np.int8)
    zc = np.abs(np.diff(signs))
    zc_cumsum = np.concatenate(([0], np.cumsum(zc, dtype=np.int64)))
    zc_count = (zc_cumsum[frame_len - 1:] - zc_cumsum[:-(frame_len - 1)]) if frame_len > 1 else zc_cumsum[1:]
    zcr = (zc_count / max(frame_len - 1, 1))[::hop]
    return rms, zcr, frame_len, hop


def _energy_vad(rms: np.ndarray, zcr: np.ndarray) -> np.ndarray:
    """能量 VAD：自适应噪声底 + 绝对门限 + 过零率上限。"""
    if rms.size == 0:
        return np.array([], dtype=bool)
    noise_floor = float(np.percentile(rms, 10))
    abs_gate = 10 ** (_setting("AUDIO_VAD_DB", -45) / 20)
    gate = max(noise_floor * 3, abs_gate)
    return (rms > gate) & (zcr < _setting("AUDIO_ZCR_MAX", 0.8))


def _load_silero_model():
    global _SILERO_MODEL, _SILERO_LOAD_FAILED
    if _SILERO_MODEL is not None or _SILERO_LOAD_FAILED:
        return _SILERO_MODEL
    with _SILERO_LOCK:
        if _SILERO_MODEL is not None or _SILERO_LOAD_FAILED:
            return _SILERO_MODEL
        try:
            from silero_vad import load_silero_vad

            _SILERO_MODEL = load_silero_vad()
        except Exception:
            logger.warning("silero-vad 加载失败，回退能量 VAD", exc_info=True)
            _SILERO_LOAD_FAILED = True
    return _SILERO_MODEL


def _silero_mask(samples: np.ndarray, sample_rate: int,
                 frame_len: int, hop: int, frame_count: int) -> np.ndarray | None:
    """返回与帧序列对齐的 VAD 掩码；不可用或失败时返回 None 交由能量 VAD 兜底。"""
    model = _load_silero_model()
    if model is None:
        return None
    try:
        import torch
        from silero_vad import get_speech_timestamps

        wav = torch.from_numpy(samples.astype(np.float32))
        if sample_rate != 16000:
            import torchaudio.functional as F

            wav = F.resample(wav, sample_rate, 16000)
        segments = get_speech_timestamps(
            wav, model, sampling_rate=16000, return_seconds=False,
            min_speech_duration_ms=50, min_silence_duration_ms=100,
        )
    except Exception:
        logger.warning("silero-vad 推理失败，回退能量 VAD", exc_info=True)
        return None

    centers = (np.arange(frame_count) * hop + frame_len / 2) / sample_rate
    mask = np.zeros(frame_count, dtype=bool)
    for seg in segments:
        start = seg["start"] / 16000
        end = seg["end"] / 16000
        mask |= (centers >= start) & (centers < end)
    return mask


def _detect_vad(samples: np.ndarray, sample_rate: int, rms: np.ndarray,
                zcr: np.ndarray, frame_len: int, hop: int) -> tuple[np.ndarray, str]:
    backend = str(_setting("AUDIO_VAD_BACKEND", "energy")).strip().lower()
    if backend in ("silero", "auto"):
        mask = _silero_mask(samples, sample_rate, frame_len, hop, rms.size)
        if mask is not None and mask.size == rms.size:
            if mask.any():
                return mask, "silero"
            # silero 面向语音，鸟鸣等非语音声源可能全判为静音，此时回退能量 VAD
            logger.info("silero 未检出声段，回退能量 VAD")
    return _energy_vad(rms, zcr), "energy"


def _snr_db(rms: np.ndarray, vad: np.ndarray) -> float:
    if rms.size == 0:
        return 0.0
    eps = 1e-12
    voiced = rms[vad] if vad.any() else np.array([])
    noise = rms[~vad] if (~vad).any() else np.array([])
    voiced_power = float(np.mean(voiced ** 2)) if voiced.size else eps
    if noise.size:
        noise_power = float(np.mean(noise ** 2))
    else:
        noise_power = float(np.percentile(rms, 10) ** 2)
    ratio = max(voiced_power, eps) / max(noise_power, eps)
    return float(min(max(10 * math.log10(ratio), 0.0), 40.0))


def _score(vad_ratio: float, snr_db: float, separation: float | None,
           overlap: float | None) -> float:
    saturation = max(_setting("AUDIO_VAD_SATURATION_RATIO", 0.3), 1e-6)
    components = {
        "vad": min(vad_ratio / saturation, 1.0),
        "snr": min(max(snr_db / 30.0, 0.0), 1.0),
    }
    if separation is not None:
        components["separation"] = min(max(separation, 0.0), 1.0)
    if overlap is not None:
        components["overlap"] = 1.0 - min(max(overlap, 0.0), 1.0)

    total_weight = sum(QUALITY_WEIGHTS[key] for key in components)
    if total_weight <= 0:
        return 0.0
    score = sum(QUALITY_WEIGHTS[key] * value for key, value in components.items())
    return round(score / total_weight, 4)


def _flags(vad_ratio: float, snr_db: float, separation: float | None,
           overlap: float | None) -> list[str]:
    flags = []
    if snr_db < _setting("AUDIO_MIN_SNR_DB", 5):
        flags.append(FLAG_HIGH_NOISE)
    if vad_ratio < _setting("AUDIO_MIN_VAD_RATIO", 0.05):
        flags.append(FLAG_LOW_VAD)
    if separation is not None and separation < _setting("AUDIO_MIN_SEPARATION", 0.4):
        flags.append(FLAG_UNRELIABLE_SEPARATION)
    if overlap is not None and overlap > _setting("AUDIO_MAX_OVERLAP", 0.6):
        flags.append(FLAG_OVERLAP_HEAVY)
    return flags


def _grade(score: float, flags: list[str]) -> str:
    if FLAG_HIGH_NOISE in flags or FLAG_LOW_VAD in flags:
        return GRADE_UNRELIABLE
    if score < _setting("AUDIO_RELIABILITY_THRESHOLD", 0.5):
        return GRADE_UNRELIABLE
    # 分离质量不足 / 重叠严重属于软缺陷：最高只能判为降级
    if FLAG_UNRELIABLE_SEPARATION in flags or FLAG_OVERLAP_HEAVY in flags:
        return GRADE_DEGRADED
    if score < _setting("AUDIO_DEGRADED_THRESHOLD", 0.75):
        return GRADE_DEGRADED
    return GRADE_RELIABLE


def _build_result(samples: np.ndarray, sample_rate: int, separation: float | None,
                  overlap: float | None) -> dict:
    rms, zcr, frame_len, hop = _frame_metrics(samples, sample_rate)
    vad, vad_backend = _detect_vad(samples, sample_rate, rms, zcr, frame_len, hop)
    vad_ratio = float(vad.mean()) if vad.size else 0.0
    snr_db = _snr_db(rms, vad)
    score = _score(vad_ratio, snr_db, separation, overlap)
    flags = _flags(vad_ratio, snr_db, separation, overlap)
    grade = _grade(score, flags)
    return {
        "available": True,
        "duration": round(samples.size / sample_rate, 3) if sample_rate else 0,
        "sample_rate": sample_rate,
        "vad_ratio": round(vad_ratio, 4),
        "snr_db": round(snr_db, 2),
        "separation_quality": round(separation, 4) if separation is not None else None,
        "overlap_ratio": round(overlap, 4) if overlap is not None else None,
        "reliability_score": score,
        "grade": grade,
        "flags": flags,
        "vad_backend": vad_backend,
        "flag": flags[0] if flags and grade == GRADE_UNRELIABLE else (
            FLAG_AUDIO_DEGRADED if grade == GRADE_DEGRADED else ""
        ),
    }


def analyze_audio_file(path: str, separation_quality: float | None = None,
                       overlap_ratio: float | None = None) -> dict:
    """分析音频文件并返回质量指标；解析失败时 available=False，不影响主流程。"""
    if not path or not Path(path).exists():
        return {"available": False, "reason": "file_missing"}

    token = _RUNTIME_CONFIG.set(load_runtime_config())
    try:
        samples, sample_rate = _load_audio(path)
        if samples.size == 0:
            return {"available": False, "reason": "empty_audio"}
        result = _build_result(samples, sample_rate, separation_quality, overlap_ratio)
        result["format"] = Path(path).suffix.lower().lstrip(".")
        return result
    except Exception as exc:
        logger.warning("音频解析失败 path=%s: %s", path, exc)
        return {"available": False, "reason": str(exc)}
    finally:
        _RUNTIME_CONFIG.reset(token)


def merge_provider_metrics(metrics: dict, separation_quality: float | None,
                           noise_ratio: float | None) -> dict:
    """把推理服务返回的分离质量/噪声比并入评分，优先使用服务端实测值。"""
    if not metrics or not metrics.get("available"):
        return metrics or {}

    token = _RUNTIME_CONFIG.set(load_runtime_config())
    try:
        separation = separation_quality if separation_quality is not None else None
        if separation is not None and noise_ratio is not None:
            separation = max(0.0, separation * (1.0 - min(max(noise_ratio, 0.0), 1.0)))

        result = dict(metrics)
        result["separation_quality"] = round(separation, 4) if separation is not None else None
        result["noise_ratio"] = round(noise_ratio, 4) if noise_ratio is not None else None
        result["reliability_score"] = _score(
            result["vad_ratio"], result["snr_db"], separation, result.get("overlap_ratio"),
        )
        flags = _flags(result["vad_ratio"], result["snr_db"], separation,
                       result.get("overlap_ratio"))
        result["flags"] = flags
        result["grade"] = _grade(result["reliability_score"], flags)
        result["flag"] = flags[0] if flags and result["grade"] == GRADE_UNRELIABLE else (
            FLAG_AUDIO_DEGRADED if result["grade"] == GRADE_DEGRADED else ""
        )
        return result
    finally:
        _RUNTIME_CONFIG.reset(token)
