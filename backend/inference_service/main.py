"""物种识别推理服务（Ultralytics YOLOv8 图像检测 + 分割 + PANNs 声学识别）。

启动：
    python main.py            # 默认 127.0.0.1:9000

协议：
    POST /v1/predict/image   支持 multipart 直传 file，也支持 JSON 的 file_url / file_path
    POST /v1/predict/audio   基于 PANNs 的声学事件识别
    GET  /v1/health          模型加载状态与类别映射数量

配置（环境变量）：
    INFERENCE_MODEL_PATH     YOLOv8 检测权重路径 (.pt)
    INFERENCE_SEG_MODEL_PATH YOLOv8-seg 分割权重路径（可选）
    INFERENCE_CLASSES_PATH   图像类别映射 JSON 路径
    INFERENCE_AUDIO_CLASSES_PATH 声学类别映射 JSON 路径
    INFERENCE_CONF           检测置信度阈值，默认 0.25
    INFERENCE_IOU            NMS IoU，默认 0.45
    INFERENCE_DEVICE         cpu / cuda:0
    INFERENCE_HOST / PORT    监听地址，默认 127.0.0.1:9000
    INFERENCE_TOKEN          可选 Bearer Token
    INFERENCE_ENABLE_SEG     true/false，是否启用分割模型，默认 true
    INFERENCE_ENABLE_AUDIO   true/false，是否加载 PANNs 声学模型，默认 true
"""
from __future__ import annotations

import json
import logging
import os
import tempfile
import time
import traceback
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

BASE_DIR = Path(__file__).resolve().parent
logger = logging.getLogger(__name__)

MODEL_PATH = Path(os.getenv("INFERENCE_MODEL_PATH", r"D:\pythonDev\industrial_anomaly_detection\yolov8modle\yolov8n.pt"))
SEG_MODEL_PATH = Path(os.getenv("INFERENCE_SEG_MODEL_PATH", ""))  # 空则自动下载 yolov8n-seg.pt
CLASSES_PATH = Path(os.getenv("INFERENCE_CLASSES_PATH", BASE_DIR / "classes.json"))
AUDIO_CLASSES_PATH = Path(os.getenv("INFERENCE_AUDIO_CLASSES_PATH", BASE_DIR / "audio_classes.json"))
CONF_THRESHOLD = float(os.getenv("INFERENCE_CONF", "0.25"))
IOU_THRESHOLD = float(os.getenv("INFERENCE_IOU", "0.45"))
DEVICE = os.getenv("INFERENCE_DEVICE", "cpu")
API_TOKEN = os.getenv("INFERENCE_TOKEN", "")
DOWNLOAD_TIMEOUT = int(os.getenv("INFERENCE_DOWNLOAD_TIMEOUT", "30"))
ENABLE_SEG = os.getenv("INFERENCE_ENABLE_SEG", "true").lower() in ("true", "1", "yes", "on")
ENABLE_AUDIO = os.getenv("INFERENCE_ENABLE_AUDIO", "true").lower() in ("true", "1", "yes", "on")
ENABLE_SEPARATION = os.getenv("INFERENCE_ENABLE_SEPARATION", "true").lower() in ("true", "1", "yes", "on")
SEPARATION_MODEL = os.getenv("INFERENCE_SEPARATION_MODEL", "htdemucs")  # htdemucs | mdx_extra | lite

_state = {
    "det_model": None,      # YOLOv8 检测
    "seg_model": None,      # YOLOv8-seg 分割
    "audio_model": None,    # PANNs 声学
    "audio_emb": None,      # PANNs 嵌入（可选）
    "separation_model": None,  # Demucs 声源分离
    "classes": {},          # 图像类别映射
    "audio_classes": {},    # 声学类别映射
    "warnings": [],         # 加载过程中产生的警告/降级原因
}


def load_json_classes(path: Path) -> dict:
    if not path.exists():
        logger.warning("类别映射文件不存在: %s", path)
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    result: dict[int, dict] = {}
    for key, value in raw.items():
        if not str(key).lstrip("-").isdigit():
            continue
        result[int(key)] = value
    return result


def load_models() -> None:
    """按配置加载模型，失败不阻塞服务启动，health 接口暴露降级原因."""
    # 确保后续相对路径权重能被正确加载
    os.chdir(BASE_DIR)
    warnings: list[str] = []
    _state["classes"] = load_json_classes(CLASSES_PATH)
    _state["audio_classes"] = load_json_classes(AUDIO_CLASSES_PATH)

    # ── 图像检测 ──
    try:
        from ultralytics import YOLO
        if not MODEL_PATH.exists():
            warnings.append(f"检测模型文件不存在: {MODEL_PATH}")
            _state["det_model"] = None
        else:
            _state["det_model"] = YOLO(str(MODEL_PATH))
    except Exception as exc:
        warnings.append(f"检测模型加载失败: {exc}")
        _state["det_model"] = None

    # ── 图像分割（可选，自动降级）──
    if ENABLE_SEG:
        try:
            from ultralytics import YOLO as SegYOLO
            if SEG_MODEL_PATH and Path(SEG_MODEL_PATH).exists():
                seg_path = str(SEG_MODEL_PATH)
            else:
                seg_path = "yolov8n-seg.pt"  # 首次自动下载
            _state["seg_model"] = SegYOLO(seg_path, task="segment")
        except Exception as exc:
            warnings.append(f"分割模型加载失败（仍会输出检测结果）: {exc}")
            _state["seg_model"] = None
    else:
        _state["seg_model"] = None

    # ── 声学识别（可选）──
    if ENABLE_AUDIO:
        try:
            from panns_inference import AudioTagging
            _state["audio_model"] = AudioTagging(checkpoint_path=None, device=DEVICE)
            # embedding 可选加载
            try:
                from panns_inference import AudioEmbedding
                _state["audio_emb"] = AudioEmbedding(checkpoint_path=None, device=DEVICE)
            except Exception as exc:
                warnings.append(f"声学 embedding 模型跳过: {exc}")
                _state["audio_emb"] = None
        except Exception as exc:
            warnings.append(f"声学模型加载失败: {exc}")
            _state["audio_model"] = None
    else:
        _state["audio_model"] = None
        _state["audio_emb"] = None

    # ── 声源分离（Demucs，可选，自动降级）──
    if ENABLE_SEPARATION:
        try:
            from demucs import pretrained as _demucs_pretrained
            _state["separation_model"] = _demucs_pretrained.get_model(SEPARATION_MODEL)
            logger.info("声源分离模型加载成功: %s", SEPARATION_MODEL)
        except ImportError:
            warnings.append("demucs 未安装（pip install demucs），声源分离不可用")
            _state["separation_model"] = None
        except Exception as exc:
            warnings.append(f"声源分离模型加载失败: {exc}")
            _state["separation_model"] = None
    else:
        _state["separation_model"] = None

    _state["warnings"] = warnings
    for w in warnings:
        logger.warning(w)


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_models()
    yield


app = FastAPI(title="生物多样性识别推理服务", version="2.0.0", lifespan=lifespan)


def _check_token(request: Request) -> None:
    if API_TOKEN and request.headers.get("Authorization") != f"Bearer {API_TOKEN}":
        raise HTTPException(status_code=401, detail="unauthenticated")


def _model_version(prefix: str, path: Path | str) -> str:
    stem = Path(str(path)).stem if str(path) else "yolov8n-seg"
    return f"{prefix}:{stem}"


# ════════════════════════════════════════════════════════════════════
# 文件读写辅助
# ════════════════════════════════════════════════════════════════════

def _download(url: str) -> str:
    resp = requests.get(url, timeout=DOWNLOAD_TIMEOUT)
    resp.raise_for_status()
    suffix = Path(url.split("?")[0]).suffix or ".jpg"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(resp.content)
    tmp.close()
    return tmp.name


async def _read_media(request: Request, accept_audio: bool = False) -> tuple[str, bool]:
    """兼容 multipart 直传与 JSON URL/本地路径两种方式."""
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await request.form()
        upload = form.get("file")
        if upload is None:
            raise HTTPException(status_code=422, detail="缺少 file 字段")
        suffix = Path(getattr(upload, "filename", "") or ("upload.wav" if accept_audio else "upload.jpg")).suffix or (".wav" if accept_audio else ".jpg")
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.write(await upload.read())
        tmp.close()
        return tmp.name, True

    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=422, detail="请求体必须是 multipart 或 JSON") from exc

    if body.get("file_url"):
        return _download(body["file_url"]), True
    if body.get("file_path"):
        path = Path(body["file_path"])
        if not path.exists():
            raise HTTPException(status_code=422, detail=f"文件不存在: {path}")
        return str(path), False
    raise HTTPException(status_code=422, detail="缺少 file / file_url / file_path")


# ════════════════════════════════════════════════════════════════════
# 图像推理：YOLOv8 检测 + 可选分割
# ════════════════════════════════════════════════════════════════════

def _rle_encode(binary_mask: np.ndarray) -> dict:
    """二值 mask → RLE（跨平台版本，避免 pycocotools Windows 编译依赖）.

    格式：按行扫描，返回 {size: [H,W], counts: [...]}
    """
    h, w = binary_mask.shape
    flat = binary_mask.flatten(order="F").astype(np.uint8)
    if flat.size == 0:
        return {"size": [h, w], "counts": ""}
    # RLE 编码：从第一个值开始，交替记录连续相同值的长度
    # COCO RLE 的 counts 是 bytes，但 JSON 不支持 bytes → 存为 list of int
    from pycocotools import mask as mask_utils  # noqa: F401  — 已在顶部尝试装过
    rle = mask_utils.encode(np.asfortranarray(binary_mask.astype(np.uint8)))
    rle["counts"] = rle["counts"].decode("utf-8")
    return rle


def _build_image_result(image_path: str) -> dict:
    det = _state["det_model"]
    if det is None:
        raise HTTPException(status_code=503, detail=f"检测模型未加载: {_state['warnings']}")

    # ── 检测 ──
    det_start = time.perf_counter()
    det_results = det.predict(
        source=image_path, conf=CONF_THRESHOLD, iou=IOU_THRESHOLD,
        device=DEVICE, verbose=False,
    )
    det_outcome = det_results[0] if det_results else None
    classes = _state["classes"]
    boxes = det_outcome.boxes if det_outcome is not None else []

    aggregated: dict[int, dict] = {}
    unmapped: dict[int, int] = {}
    for box in boxes:
        class_id = int(box.cls.item())
        confidence = round(float(box.conf.item()), 4)
        entry = classes.get(class_id)
        if not entry:
            unmapped[class_id] = unmapped.get(class_id, 0) + 1
            continue
        bbox = [round(v, 1) for v in box.xyxy[0].tolist()]
        item = aggregated.get(class_id)
        if item is None:
            aggregated[class_id] = {
                "species_id": entry.get("species_id"),
                "chinese_name": entry.get("chinese_name", ""),
                "latin_name": entry.get("latin_name", ""),
                "severity": entry.get("severity", "none"),
                "confidence": confidence,
                "count": 1,
                "bbox": bbox,
                "bboxes": [bbox],
            }
        else:
            item["count"] += 1
            item["bboxes"].append(bbox)
            item["confidence"] = max(item["confidence"], confidence)

    top_k = sorted(aggregated.values(), key=lambda x: x["confidence"], reverse=True)[:5]
    det_latency_ms = int((time.perf_counter() - det_start) * 1000)

    # ── 分割（可选）──
    segmentations: list[dict] = []
    seg_latency_ms = 0
    seg_model = _state["seg_model"]
    if seg_model is not None and len(boxes) > 0:
        try:
            seg_start = time.perf_counter()
            # 独立导入避免与 det YOLO 全局变量冲突
            from ultralytics import YOLO as _SegYOLO
            seg_model_fresh = _SegYOLO("yolov8n-seg.pt", task="segment")
            seg_results = seg_model_fresh.predict(
                source=image_path, conf=CONF_THRESHOLD, iou=IOU_THRESHOLD,
                device=DEVICE, verbose=False,
            )
            seg_outcome = seg_results[0] if seg_results else None
            if seg_outcome is not None and seg_outcome.masks is not None:
                for i, seg_mask in enumerate(seg_outcome.masks.data):
                    seg_class_id = int(seg_outcome.boxes.cls[i].item())
                    seg_conf = round(float(seg_outcome.boxes.conf[i].item()), 4)
                    seg_bbox = [round(v, 1) for v in seg_outcome.boxes.xyxy[i].tolist()]
                    seg_entry = classes.get(seg_class_id)

                    # 用 RLE 压缩
                    mask = seg_mask.cpu().numpy().astype(np.uint8)
                    try:
                        rle = _rle_encode(mask)
                    except Exception:
                        rle = {"size": list(mask.shape), "counts": ""}

                    segmentations.append({
                        "class_id": seg_class_id,
                        "species_id": seg_entry.get("species_id") if seg_entry else None,
                        "chinese_name": seg_entry.get("chinese_name", "") if seg_entry else "",
                        "confidence": seg_conf,
                        "bbox": seg_bbox,
                        "mask_rle": rle,
                        "area_pixels": int(mask.sum()),
                    })
            seg_latency_ms = int((time.perf_counter() - seg_start) * 1000)
        except Exception as exc:
            logger.warning("分割推理失败（忽略）: %s", exc)

    model_version_det = _model_version("yolo", MODEL_PATH)
    model_version_seg = _model_version("yolo-seg", SEG_MODEL_PATH or "yolov8n-seg.pt")

    names = det_outcome.names if det_outcome is not None else {}
    return {
        "model_version": model_version_det,
        "top_k": top_k,
        "quality_flag": "" if top_k else "no_mapped_detection",
        "noise_ratio": 0.0,
        "separation_quality": None,
        "seg_model_version": model_version_seg if segmentations else "",
        "segmentations": segmentations,
        "seg_latency_ms": seg_latency_ms,
        "seg_count": len(segmentations),
        "raw": {
            "provider": "ultralytics+yolo-seg",
            "det_model": str(MODEL_PATH),
            "seg_model": str(SEG_MODEL_PATH or "yolov8n-seg.pt"),
            "detections": int(len(boxes)),
            "segmentations_count": len(segmentations),
            "latency_ms": {"det": det_latency_ms, "seg": seg_latency_ms},
            "unmapped": {names.get(k, str(k)): v for k, v in unmapped.items()},
        },
    }


# ════════════════════════════════════════════════════════════════════
# 音频推理：PANNs
# ════════════════════════════════════════════════════════════════════

def _estimate_audio_noise(waveform: np.ndarray, sr: int) -> float:
    """简易噪声估计：基于短帧能量的中位数偏差."""
    try:
        frame_len = int(sr * 0.025)  # 25ms
        hop = frame_len // 2
        if len(waveform) < frame_len:
            return 0.0
        frames = np.array([waveform[i:i + frame_len] for i in range(0, len(waveform) - frame_len, hop)])
        energies = np.mean(frames ** 2, axis=1)
        if energies.size == 0:
            return 0.0
        med = np.median(energies)
        if med < 1e-10:
            return 0.0
        return round(float(np.std(energies) / (med + 1e-10)), 3)
    except Exception:
        return 0.0


def _build_audio_result(audio_path: str) -> dict:
    audio_model = _state["audio_model"]
    if audio_model is None:
        raise HTTPException(status_code=503, detail=f"声学模型未加载: {_state['warnings']}")

    try:
        import librosa
    except ImportError as exc:
        raise HTTPException(status_code=503, detail=f"librosa 未安装: {exc}") from exc

    # ── 加载 & 预处理 ──
    audio_start = time.perf_counter()
    try:
        waveform, sr = librosa.load(audio_path, sr=16000, mono=True)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"音频解码失败: {exc}") from exc

    # 过长音频截取前 60s（PANNs 单次推理推荐 ≤ 10s）
    max_samples = 60 * 16000
    if len(waveform) > max_samples:
        waveform = waveform[:max_samples]

    # ── 可选：Demucs 声源分离 ──
    separated_waveform = waveform
    separation_quality: float | None = None
    separation_latency_ms = 0
    separation_sources: dict[str, float] = {}
    sep_model = _state["separation_model"]
    if sep_model is not None:
        try:
            sep_start = time.perf_counter()
            import torch
            # Demucs 需要双声道，先把单声道复制成 stereo
            stereo = np.stack([waveform, waveform], axis=0).astype(np.float32)
            wav = torch.from_numpy(stereo).unsqueeze(0)  # (1, 2, T)
            with torch.no_grad():
                ref = wav.mean(1).unsqueeze(1)
                wav = (wav - ref.mean()) / ref.std()
                sources = sep_model(wav)[0]
                sources = sources * ref.std() + ref.mean()
            # 把各个 source 汇总回单声道（取 max 能量 source，或合并非 vocal sources）
            # 简化策略：把所有 source 加总 → 去除人声 → 得到"环境音/物种声"
            source_list = sources.detach().cpu().numpy()  # (4, 2, T) htdemucs: drums/bass/other/vocals
            n_sources = source_list.shape[0]
            vocals_idx = 3  # htdemucs 第 4 个通道是 vocals
            non_vocal_idx = [i for i in range(n_sources) if i != vocals_idx]
            env_wave = source_list[non_vocal_idx].mean(axis=0).mean(axis=0)  # 单声道
            # 能量比：分离前后的 SNR 简易估计
            orig_energy = float(np.mean(waveform ** 2) + 1e-10)
            sep_energy = float(np.mean(env_wave ** 2) + 1e-10)
            separation_quality = round(min(sep_energy / orig_energy, 1.0), 3)
            separation_latency_ms = int((time.perf_counter() - sep_start) * 1000)
            separated_waveform = env_wave.astype(np.float32)
            separation_sources = {f"source_{i}": float(np.mean(source_list[i] ** 2)) for i in range(n_sources)}
            logger.info("声源分离完成: %d sources, quality=%.3f, latency=%dms",
                        n_sources, separation_quality, separation_latency_ms)
        except Exception as exc:
            logger.warning("声源分离失败（忽略，继续直接 PANNs）: %s", exc)

    # ── PANNs 推理（用分离后的波形或原始波形）──
    try:
        from panns_inference import AudioTagging
        tags, _ = audio_model.inference(separated_waveform)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PANNs 推理失败: {exc}") from exc

    # ── 映射到系统物种 ──
    audio_classes = _state["audio_classes"]
    seen = set()
    top_k: list[dict] = []
    for class_id, prob in tags[:30]:
        entry = audio_classes.get(class_id)
        if not entry:
            continue
        species_id = entry.get("species_id")
        key = (species_id, entry.get("chinese_name", ""))
        if key in seen:
            continue
        seen.add(key)
        top_k.append({
            "species_id": species_id,
            "chinese_name": entry.get("chinese_name", ""),
            "latin_name": entry.get("latin_name", ""),
            "confidence": round(float(prob), 4),
            "count": 1,
            "bbox": None,
            "severity": entry.get("severity", "none"),
        })
        if len(top_k) >= 5:
            break

    latency_ms = int((time.perf_counter() - audio_start) * 1000)
    noise_ratio = _estimate_audio_noise(waveform, sr)
    quality_flag = ""
    if noise_ratio > 0.8:
        quality_flag = "high_noise"
    elif top_k and top_k[0]["confidence"] < 0.1:
        quality_flag = "low_confidence"

    return {
        "model_version": "panns-cnn14-527",
        "top_k": top_k[:5],
        "quality_flag": quality_flag,
        "noise_ratio": noise_ratio,
        "separation_quality": separation_quality,
        "separation_latency_ms": separation_latency_ms,
        "separation_sources": separation_sources,
        "segments": [],
        "raw": {
            "provider": "panns-cnn14",
            "audio_duration": round(len(waveform) / 16000, 2),
            "sr": 16000,
            "latency_ms": latency_ms,
            "total_tags": len(tags),
            "tags_top10": [{"class_id": int(cid), "confidence": round(float(p), 4)} for cid, p in tags[:10]],
        },
    }


# ════════════════════════════════════════════════════════════════════
# FastAPI 路由
# ════════════════════════════════════════════════════════════════════

def _ensure_det_model() -> None:
    if _state["det_model"] is None:
        raise HTTPException(status_code=503, detail=f"检测模型未加载: {_state['warnings']}")


@app.post("/v1/predict/image")
async def predict_image(request: Request):
    _check_token(request)
    _ensure_det_model()
    path, is_temp = await _read_media(request, accept_audio=False)
    try:
        return _build_image_result(path)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("图像推理失败: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"推理失败: {exc}") from exc
    finally:
        if is_temp:
            try:
                os.unlink(path)
            except OSError:
                pass


@app.post("/v1/predict/audio")
async def predict_audio(request: Request):
    _check_token(request)
    if _state["audio_model"] is None:
        raise HTTPException(status_code=503, detail=f"声学模型未加载: {_state['warnings']}")
    path, is_temp = await _read_media(request, accept_audio=True)
    try:
        return _build_audio_result(path)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("声学推理失败: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"推理失败: {exc}") from exc
    finally:
        if is_temp:
            try:
                os.unlink(path)
            except OSError:
                pass


@app.get("/v1/health")
async def health():
    det_loaded = _state["det_model"] is not None
    seg_loaded = _state["seg_model"] is not None
    audio_loaded = _state["audio_model"] is not None
    sep_loaded = _state["separation_model"] is not None
    status = "ok" if (det_loaded or audio_loaded) else "degraded"
    return {
        "status": status,
        "provider": "ultralytics+panns+demucs",
        "device": DEVICE,
        "det": {
            "loaded": det_loaded,
            "model_path": str(MODEL_PATH),
            "model_version": _model_version("yolo", MODEL_PATH) if det_loaded else "",
        },
        "seg": {
            "loaded": seg_loaded,
            "model_version": _model_version("yolo-seg", SEG_MODEL_PATH or "yolov8n-seg.pt") if seg_loaded else "",
        },
        "audio": {
            "loaded": audio_loaded,
            "model_version": "panns-cnn14-527" if audio_loaded else "",
            "embedding_loaded": _state["audio_emb"] is not None,
        },
        "separation": {
            "loaded": sep_loaded,
            "model_version": SEPARATION_MODEL if sep_loaded else "",
        },
        "classes_image": len(_state["classes"]),
        "classes_audio": len(_state["audio_classes"]),
        "warnings": _state["warnings"],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=os.getenv("INFERENCE_HOST", "127.0.0.1"),
        port=int(os.getenv("INFERENCE_PORT", "9000")),
    )
