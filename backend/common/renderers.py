"""Standard renderer — wraps DRF response into unified format when not already wrapped."""
from rest_framework.renderers import JSONRenderer


class StandardRenderer(JSONRenderer):
    charset = "utf-8"

    # drf-spectacular 的 schema/文档端点不包装，避免破坏 OpenAPI 结构
    EXEMPT_PATH_PREFIXES = ("/api/schema", "/api/docs", "/api/redoc")

    def render(self, data, accepted_media_type=None, renderer_context=None):
        renderer_context = renderer_context or {}
        request = renderer_context.get("request")
        if request and request.path.startswith(self.EXEMPT_PATH_PREFIXES):
            return super().render(data, accepted_media_type, renderer_context)

        response = renderer_context.get("response")
        status_code = getattr(response, "status_code", 200) or 200

        # 已按统一格式包装的成功响应 {code, message, data}
        if isinstance(data, dict) and "code" in data and "data" in data:
            return super().render(data, accepted_media_type, renderer_context)

        if status_code >= 400:
            # 已由 exception_handler 格式化为 {code, message, errors?}
            if isinstance(data, dict) and "code" in data:
                return super().render(data, accepted_media_type, renderer_context)
            # 未经过 exception_handler 的错误（如 DRF 默认格式），兜底包装
            message = ""
            if isinstance(data, dict):
                message = str(data.get("detail") or data)
            else:
                message = str(data or "请求处理失败")
            wrapped = {"code": status_code * 100 + 1, "message": message, "data": None}
            return super().render(wrapped, accepted_media_type, renderer_context)

        # 成功响应统一包装
        if data is None:
            data = ""
        wrapped = {
            "code": 0,
            "message": "ok",
            "data": data,
        }
        return super().render(wrapped, accepted_media_type, renderer_context)
