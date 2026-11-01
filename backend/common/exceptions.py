"""Standard exception handler — converts DRF/Django exceptions into unified error format."""
from rest_framework.views import exception_handler
from rest_framework.exceptions import APIException, ValidationError, NotAuthenticated, PermissionDenied, NotFound
from rest_framework import status


def standard_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        # BusinessError 等自定义异常已自带标准格式 {code, message}，直接透传
        detail = getattr(exc, "detail", None)
        if isinstance(detail, dict) and "code" in detail:
            response.data = detail
            return response

        code_map = {
            NotAuthenticated: 40101,
            PermissionDenied: 40301,
            NotFound: 40401,
            ValidationError: 40001,
        }
        code = code_map.get(type(exc), response.status_code * 100 + 1)

        # 优先取 DRF 转换后的响应 detail（如 Http404 → NotFound 的情况）
        if isinstance(response.data, dict) and "detail" in response.data:
            message = response.data["detail"]
        else:
            message = getattr(exc, "detail", None)
        if isinstance(message, list):
            message = "; ".join(str(m) for m in message)
        elif isinstance(message, dict):
            message = "参数校验失败"

        errors = None
        if isinstance(exc, ValidationError):
            errors = exc.detail if isinstance(exc.detail, dict) else None

        response.data = {
            "code": code,
            "message": str(message) if message else "请求处理失败",
        }
        if errors:
            response.data["errors"] = errors

    return response


class BusinessError(APIException):
    """Business-level error with custom code."""

    def __init__(self, code, message, status_code=status.HTTP_400_BAD_REQUEST):
        self.code = code
        self.detail = {"code": code, "message": message}
        self.status_code = status_code
        super().__init__(detail=self.detail, code=status_code)
