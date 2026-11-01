"""Standard pagination — wraps DRF pagination response into unified format."""
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "pageSize"
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            "code": 0,
            "message": "ok",
            "data": {
                "list": data,
                "total": self.page.paginator.count,
                "page": self.page.number,
                "pageSize": self.get_page_size(self.request),
            },
        })

    def get_paginated_response_schema(self, schema):
        return {
            "type": "object",
            "properties": {
                "code": {"type": "integer", "example": 0},
                "message": {"type": "string", "example": "ok"},
                "data": {
                    "type": "object",
                    "properties": {
                        "list": schema,
                        "total": {"type": "integer", "example": 100},
                        "page": {"type": "integer", "example": 1},
                        "pageSize": {"type": "integer", "example": 20},
                    },
                },
            },
        }
