"""远程边缘 HTTP 推理后端：配置从 SystemConfig 运行时读取，无需重启即可切换。

与 RemoteHttpProvider 的区别：
- base_url / token / input_mode 从系统配置动态读取，支持页面修改后即时生效
- 模型版本号从 edge_model_version 配置读取
"""
from __future__ import annotations

import json
import os
import time

import requests

from common.config import get_config

from .base import InferenceProvider, PredictionItem, PredictResult, ProviderError


def _cfg(key: str) -> str:
    return get_config(key)


class RemoteEdgeProvider(InferenceProvider):
    """对接边缘网关的 /v1/predict/image、/v1/predict/audio、/v1/health。"""

    name = "edge"

    def __init__(self):
        self.base_url = ""
        self.token = ""
        self.input_mode = "file"
        self.model_version = "edge-v0.4.0"
        self.media_base_url = ""
        self._reload_config()

    def _reload_config(self):
        """每次调用前重新读取运行时配置，保证页面修改即时生效。"""
        self.base_url = (_cfg("edge_http_url") or "").rstrip("/")
        self.token = _cfg("edge_http_token") or ""
        self.input_mode = (_cfg("edge_input_mode") or "file").lower()
        self.model_version = _cfg("edge_model_version") or "edge-v0.4.0"
        self.media_base_url = ""

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
        self._reload_config()
        if not self.base_url:
            raise ProviderError("未配置边缘推理服务地址(edge_http_url)",
                                code="not_configured", retryable=False)
        try:
            resp = requests.request(
                method, f"{self.base_url}{path}", headers=self._headers(),
                timeout=30, **kwargs,
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
                "url 模式需要配置媒体基础地址",
                code="not_configured", retryable=False,
            )
        return f"{self.media_base_url}{url}"

    def _file_payload(self, asset, extra: dict) -> dict:
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
            "_handle": handle,
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
                severity=item.get("severity", "none"),
            )
            for item in payload.get("top_k", [])
        ]
        return PredictResult(
            top_k=items,
            model_version=payload.get("model_version", self.model_version),
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
        self._reload_config()
        if not self.base_url:
            return {"status": "not_configured", "provider": self.name,
                    "detail": "未配置边缘推理服务地址"}
        try:
            return self._request("GET", "/v1/health")
        except ProviderError as exc:
            return {"status": "error", "provider": self.name, "detail": str(exc),
                    "error_code": exc.code}
