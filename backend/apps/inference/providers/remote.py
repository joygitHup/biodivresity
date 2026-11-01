"""远端 HTTP 推理后端：平台只做客户端，模型与 GPU 由推理服务承担。"""
from __future__ import annotations

import json
import os
import time

import requests
from django.conf import settings

from .base import InferenceProvider, PredictionItem, PredictResult, ProviderError


class RemoteHttpProvider(InferenceProvider):
    """对接 /v1/predict/image、/v1/predict/audio、/v1/health。

    支持三种文件传递方式（INFERENCE_INPUT_MODE）：
    - file：multipart 直传文件（默认）
    - url：传可访问的 media URL（需配置 INFERENCE_MEDIA_BASE_URL）
    - path：传平台本地文件绝对路径（推理服务与平台共享存储时使用）
    """

    name = "http"

    def __init__(self):
        self.base_url = (settings.INFERENCE_BASE_URL or "").rstrip("/")
        self.token = settings.INFERENCE_TOKEN
        self.timeout = settings.INFERENCE_TIMEOUT
        self.input_mode = (getattr(settings, "INFERENCE_INPUT_MODE", "file") or "file").lower()
        self.media_base_url = (getattr(settings, "INFERENCE_MEDIA_BASE_URL", "") or "").rstrip("/")

    def _headers(self) -> dict:
        headers = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _check_response(self, resp: requests.Response) -> dict:
        if resp.status_code == 422:
            raise ProviderError(self._detail(resp) or "推理服务拒绝该文件",
                                code="invalid_input", retryable=False)
        if resp.status_code >= 500:
            raise ProviderError(f"推理服务错误 {resp.status_code}", code="server_error")
        if resp.status_code >= 400:
            raise ProviderError(f"推理服务返回 {resp.status_code}", code="bad_request",
                                retryable=False)
        try:
            return resp.json()
        except ValueError as exc:
            raise ProviderError("推理服务返回非 JSON", code="bad_response") from exc

    @staticmethod
    def _detail(resp: requests.Response) -> str:
        try:
            payload = resp.json()
            return str(payload.get("detail") or payload.get("message") or "")
        except ValueError:
            return resp.text[:200]

    def _request(self, method: str, path: str, **kwargs) -> dict:
        if not self.base_url:
            raise ProviderError("未配置 INFERENCE_BASE_URL",
                                code="not_configured", retryable=False)
        try:
            resp = requests.request(
                method, f"{self.base_url}{path}", headers=self._headers(),
                timeout=self.timeout, **kwargs,
            )
        except requests.Timeout as exc:
            raise ProviderError(f"推理服务超时: {exc}", code="timeout") from exc
        except requests.RequestException as exc:
            raise ProviderError(f"推理服务不可达: {exc}", code="unreachable") from exc
        return self._check_response(resp)

    # ── 文件传递 ──────────────────────────────────────────────

    def _media_url(self, asset) -> str:
        if not asset.file:
            raise ProviderError("资产缺少文件", code="invalid_input", retryable=False)
        url = asset.file.url
        if url.startswith("http"):
            return url
        if not self.media_base_url:
            raise ProviderError(
                "url 模式需要配置 INFERENCE_MEDIA_BASE_URL",
                code="not_configured", retryable=False,
            )
        return f"{self.media_base_url}{url}"

    def _file_payload(self, asset, extra: dict) -> dict:
        """根据 input_mode 构造请求体；file 模式返回 multipart 参数。"""
        if self.input_mode == "url":
            return {
                "json": {**extra, "file_url": self._media_url(asset), "sha256": asset.sha256},
            }
        if self.input_mode == "path":
            # 对象存储(MinIO)没有本地路径，回退为直传文件
            try:
                path = asset.file.path
            except Exception:
                path = None
            if path:
                return {"json": {**extra, "file_path": path, "sha256": asset.sha256}}

        if not asset.file:
            raise ProviderError("资产缺少文件", code="invalid_input", retryable=False)
        filename = os.path.basename(asset.file.name or "upload")
        mime = asset.mime_type or "application/octet-stream"
        handle = asset.file.open("rb")
        data = {
            key: json.dumps(value) if isinstance(value, (dict, list)) else str(value)
            for key, value in extra.items()
        }
        data["sha256"] = asset.sha256
        return {
            "files": {"file": (filename, handle, mime)},
            "data": data,
            "_handle": handle,  # 调用方负责关闭
        }

    def _post_asset(self, path: str, asset, extra: dict) -> dict:
        params = self._file_payload(asset, extra)
        handle = params.pop("_handle", None)
        try:
            return self._request("POST", path, **params)
        finally:
            if handle is not None:
                handle.close()

    def _to_result(self, payload: dict, started: float) -> PredictResult:
        items = [
            PredictionItem(
                species_id=item.get("species_id") or item.get("category_id"),
                chinese_name=item.get("name") or item.get("chinese_name", ""),
                latin_name=item.get("latin_name", ""),
                confidence=float(item.get("confidence", 0)),
                count=int(item.get("count", 1)),
                bbox=item.get("bbox"),
                protection_level=item.get("protection_level", "none"),
            )
            for item in payload.get("top_k", [])
        ]
        return PredictResult(
            top_k=items,
            model_version=payload.get("model_version", ""),
            provider=self.name,
            latency_ms=int((time.perf_counter() - started) * 1000),
            quality_flag=payload.get("quality_flag", ""),
            noise_ratio=payload.get("noise_ratio", 0.0),
            separation_quality=payload.get("separation_quality"),
            segments=payload.get("segments", []),
            raw=payload,
        )

    def predict_image(self, asset, context: dict) -> PredictResult:
        started = time.perf_counter()
        payload = self._post_asset("/v1/predict/image", asset, {"context": context or {}})
        return self._to_result(payload, started)

    def predict_audio(self, asset, context: dict) -> PredictResult:
        started = time.perf_counter()
        payload = self._post_asset("/v1/predict/audio", asset, {
            "context": context or {},
            "segment_seconds": 5,
            "overlap": 0.5,
        })
        return self._to_result(payload, started)

    def health(self) -> dict:
        if not self.base_url:
            return {"status": "not_configured", "provider": self.name}
        try:
            return self._request("GET", "/v1/health")
        except ProviderError as exc:
            return {"status": "error", "provider": self.name, "detail": str(exc),
                    "error_code": exc.code}
