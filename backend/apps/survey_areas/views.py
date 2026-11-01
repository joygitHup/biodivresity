from rest_framework import viewsets, status
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema_view, extend_schema
from apps.users.mixins import AuditModelViewSetMixin
from .models import SurveyArea
from .serializers import (
    SurveyAreaListSerializer,
    SurveyAreaDetailSerializer,
    SurveyAreaWriteSerializer,
)


@extend_schema_view(
    list=extend_schema(summary="样区列表"),
    retrieve=extend_schema(summary="样区详情"),
    create=extend_schema(summary="创建样区"),
    update=extend_schema(summary="更新样区"),
    partial_update=extend_schema(summary="部分更新样区"),
    destroy=extend_schema(summary="删除样区"),
)
class SurveyAreaViewSet(AuditModelViewSetMixin, viewsets.ModelViewSet):
    queryset = SurveyArea.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["type", "status"]
    search_fields = ["name", "vegetation"]
    ordering_fields = ["area", "device_count", "species_count", "created_at"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return SurveyAreaListSerializer
        if self.action == "retrieve":
            return SurveyAreaDetailSerializer
        return SurveyAreaWriteSerializer

    def create(self, request, *args, **kwargs):
        # 输入用 WriteSerializer 校验，输出用 DetailSerializer 返回完整对象（含 id）
        serializer = SurveyAreaWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            SurveyAreaDetailSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = SurveyAreaWriteSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(SurveyAreaDetailSerializer(instance).data)
