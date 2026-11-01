"""跨模态证据融合接口：证据簇查询/复核/重建、统计与 eDNA 证据录入。"""
from __future__ import annotations

from datetime import timedelta

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from common.permissions import IsAdminOrStaff

from .models import EdnaEvidence, EvidenceCluster
from .serializers import (
    EdnaEvidenceSerializer,
    EvidenceClusterDetailSerializer,
    EvidenceClusterListSerializer,
)
from .services import (
    distribution_stats,
    fusion_stats,
    rebuild_for_evidence,
    rebuild_range,
    record_review,
)


@extend_schema_view(
    list=extend_schema(summary="证据簇列表"),
    retrieve=extend_schema(summary="证据簇详情"),
)
class EvidenceClusterViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = EvidenceCluster.objects.select_related(
        "species", "survey_area", "device", "reviewer",
    ).all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = {
        "species": ["exact"],
        "survey_area": ["exact"],
        "device": ["exact"],
        "status": ["exact"],
        "fused_grade": ["exact"],
        "conflict_flag": ["exact"],
        "modality_count": ["gte", "lt"],
        "has_image": ["exact"],
        "has_audio": ["exact"],
        "has_edna": ["exact"],
        "fused_confidence": ["gte", "lt"],
        "window_start": ["gte", "lte"],
    }
    search_fields = ["species__chinese_name", "species__latin_name", "survey_area__name"]
    ordering_fields = ["window_start", "fused_confidence", "evidence_count", "updated_at"]
    ordering = ["-window_start", "-fused_confidence"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return EvidenceClusterDetailSerializer
        return EvidenceClusterListSerializer

    @extend_schema(summary="证据簇复核(确认/驳回)")
    @action(detail=True, methods=["post"], permission_classes=[IsAdminOrStaff])
    def review(self, request, pk=None):
        cluster = self.get_object()
        action_value = request.data.get("status")
        allowed = (EvidenceCluster.Status.CONFIRMED, EvidenceCluster.Status.REJECTED)
        if action_value not in allowed:
            return Response(
                {"code": 40001, "message": "复核状态仅支持 confirmed / rejected"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        record_review(cluster, action_value, request.user, request.data.get("remark", ""))
        from apps.users.audit import audit_action
        audit_action(
            request, "review",
            target_type="evidence_cluster", target_id=cluster.id,
            target_label=f"证据簇#{cluster.id} {cluster.species.chinese_name if cluster.species else ''}",
            detail=f"证据融合复核：{'确认' if action_value == 'confirmed' else '驳回'}",
        )
        return Response({
            "code": 0, "message": "ok",
            "data": EvidenceClusterDetailSerializer(cluster).data,
        })

    @extend_schema(summary="重建证据簇(指定时间范围)")
    @action(detail=False, methods=["post"], permission_classes=[IsAdminOrStaff])
    def rebuild(self, request):
        days = int(request.data.get("days") or 7)
        start = parse_datetime(str(request.data.get("start") or ""))
        end = parse_datetime(str(request.data.get("end") or ""))
        if start and timezone.is_naive(start):
            start = timezone.make_aware(start)
        if end and timezone.is_naive(end):
            end = timezone.make_aware(end)
        if not start:
            start = timezone.now() - timedelta(days=max(1, min(days, 90)))
        if not end:
            end = timezone.now()
        if start >= end:
            return Response(
                {"code": 40001, "message": "开始时间需早于结束时间"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        summary = rebuild_range(start, end)
        return Response({"code": 0, "message": "ok", "data": summary})

    @extend_schema(summary="证据融合统计")
    @action(detail=False, methods=["get"])
    def stats(self, request):
        return Response({"code": 0, "message": "ok", "data": fusion_stats()})

    @extend_schema(summary="强证据物种分布(可按样区接入统计分析)")
    @action(detail=False, methods=["get"])
    def distribution(self, request):
        days = int(request.query_params.get("days") or 30)
        return Response({
            "code": 0, "message": "ok",
            "data": distribution_stats(days=days),
        })


@extend_schema_view(
    list=extend_schema(summary="eDNA 证据列表"),
    retrieve=extend_schema(summary="eDNA 证据详情"),
    create=extend_schema(summary="录入 eDNA 证据(管理员/农技人员)"),
)
class EdnaEvidenceViewSet(viewsets.ModelViewSet):
    queryset = EdnaEvidence.objects.select_related(
        "species", "survey_area", "device", "created_by",
    ).all()
    serializer_class = EdnaEvidenceSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = {
        "species": ["exact"],
        "survey_area": ["exact"],
        "device": ["exact"],
        "result": ["exact"],
        "sampled_at": ["gte", "lte"],
    }
    search_fields = ["sample_code", "primer", "lab"]
    ordering_fields = ["sampled_at", "created_at"]
    ordering = ["-sampled_at"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdminOrStaff()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        evidence = serializer.save(created_by=self.request.user)
        # 录入后立即重建所在时间窗，融合结果即时可见
        rebuild_for_evidence(evidence)
