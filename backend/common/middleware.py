"""Request ID middleware — generates/propagates request_id across the call chain."""
import uuid


class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.id = request.headers.get("X-Request-Id") or uuid.uuid4().hex
        response = self.get_response(request)
        response["X-Request-Id"] = request.id
        return response
