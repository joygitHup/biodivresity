from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema_view, extend_schema
from apps.users.mixins import AuditModelViewSetMixin
from common.permissions import IsAdminOrStaff
from .models import Device
from .serializers import (
    DeviceListSerializer,
    DeviceDetailSerializer,
    DeviceWriteSerializer,
)


@extend_schema_view(
    list=extend_schema(summary="设备列表"),
    retrieve=extend_schema(summary="设备详情"),
    create=extend_schema(summary="创建设备"),
    update=extend_schema(summary="更新设备"),
    partial_update=extend_schema(summary="部分更新设备"),
    destroy=extend_schema(summary="删除设备"),
)
class DeviceViewSet(AuditModelViewSetMixin, viewsets.ModelViewSet):
    queryset = Device.objects.select_related("survey_area").all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["type", "status", "survey_area"]
    search_fields = ["name", "location"]
    ordering_fields = ["battery", "signal", "last_data_time", "created_at"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return DeviceListSerializer
        if self.action == "retrieve":
            return DeviceDetailSerializer
        return DeviceWriteSerializer

    def create(self, request, *args, **kwargs):
        # 输入用 WriteSerializer 校验，输出用 DetailSerializer 返回完整对象（含 id）
        serializer = DeviceWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            DeviceDetailSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = DeviceWriteSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(DeviceDetailSerializer(instance).data)

    @extend_schema(summary="生成/重置边缘设备Token")
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsAdminOrStaff])
    def edge_token(self, request, pk=None):
        """生成或重置该设备的边缘上报 Token，返回明文（仅一次展示）。"""
        device = self.get_object()
        token = device.generate_edge_token()
        return Response({
            "code": 0,
            "message": "ok",
            "data": {
                "device_id": device.id,
                "token": token,
                "token_created_at": device.edge_token_created_at,
                "warning": "Token 仅本次返回明文，请妥善保存，后续无法再次查看",
            },
        })

    @extend_schema(summary="吊销边缘设备Token")
    @edge_token.mapping.delete
    def revoke_edge_token(self, request, pk=None):
        device = self.get_object()
        device.clear_edge_token()
        return Response({"code": 0, "message": "已吊销设备Token"})

    @extend_schema(summary="设备统计（在线/离线/低电量/存储告警）")
    @action(detail=False, methods=["get"])
    def stats(self, request):
        qs = Device.objects.all()
        agg = qs.aggregate(
            total=Count("id"),
            online=Count("id", filter=Q(status="online")),
            offline=Count("id", filter=Q(status="offline")),
            warning=Count("id", filter=Q(status="warning")),
            low_battery=Count("id", filter=Q(battery__lt=30)),
            storage_alert=Count("id", filter=Q(storage__gt=80)),
        )
        return Response({
            "code": 0,
            "message": "ok",
            "data": {
                "total": agg["total"] or 0,
                "online": agg["online"] or 0,
                "offline": agg["offline"] or 0,
                "warning": agg["warning"] or 0,
                "lowBattery": agg["low_battery"] or 0,
                "storageAlert": agg["storage_alert"] or 0,
            },
        })
