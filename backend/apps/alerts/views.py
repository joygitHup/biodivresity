from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema_view, extend_schema
from apps.users.mixins import AuditModelViewSetMixin
from .models import Alert
from .serializers import AlertListSerializer, AlertDetailSerializer, AlertWriteSerializer


@extend_schema_view(
    list=extend_schema(summary="预警列表"),
    retrieve=extend_schema(summary="预警详情"),
    create=extend_schema(summary="创建预警"),
)
class AlertViewSet(AuditModelViewSetMixin, viewsets.ModelViewSet):
    queryset = Alert.objects.select_related("survey_area").all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["type", "level", "is_read", "survey_area"]
    search_fields = ["title", "description"]
    ordering_fields = ["level", "created_at"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return AlertListSerializer
        if self.action == "retrieve":
            return AlertDetailSerializer
        return AlertWriteSerializer

    @extend_schema(summary="标记已读")
    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        alert = self.get_object()
        alert.is_read = True
        alert.save()
        return Response({"code": 0, "message": "ok"})

    @extend_schema(summary="全部标记已读")
    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        Alert.objects.unread().update(is_read=True)
        return Response({"code": 0, "message": "ok"})

    @extend_schema(summary="预警统计（未读数 / 各等级数量）")
    @action(detail=False, methods=["get"])
    def stats(self, request):
        qs = Alert.objects.all()
        agg = qs.aggregate(
            unread=Count("id", filter=models.Q(is_read=False)),
            critical=Count("id", filter=models.Q(level="critical")),
            warning=Count("id", filter=models.Q(level="warning")),
            info=Count("id", filter=models.Q(level="info")),
        )
        return Response({
            "code": 0,
            "message": "ok",
            "data": {
                "unreadCount": agg["unread"] or 0,
                "totalCritical": agg["critical"] or 0,
                "totalWarning": agg["warning"] or 0,
                "totalInfo": agg["info"] or 0,
            },
        })
