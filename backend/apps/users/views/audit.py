"""AuditLog views — 轻量审计日志查询（仅自己的 + 管理员全部）."""
from datetime import timedelta

from django.utils import timezone
from django.db.models import Q, Count
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema

from ..models import AuditLog
from ..serializers.audit import AuditLogSerializer


@extend_schema(tags=["审计日志"])
class AuditLogListView(generics.GenericAPIView):
    """查询审计日志。普通用户仅看自己的；admin/staff 可看全部，支持按动作 / 对象类型 / 时间范围筛选."""
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        qs = self.get_queryset()
        total = qs.count()
        pageSize = int(request.query_params.get("pageSize", 500))
        page = int(request.query_params.get("page", 1))
        start = (page - 1) * pageSize
        items = self.get_serializer(qs[start:start + pageSize], many=True).data
        return Response({"list": items, "total": total, "page": page, "pageSize": pageSize})

    def get_queryset(self):
        user = self.request.user
        qs = AuditLog.objects.select_related("actor").all()
        if user.role not in ("admin", "staff"):
            qs = qs.filter(actor=user)

        action = self.request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)

        target_type = self.request.query_params.get("target_type")
        if target_type:
            qs = qs.filter(target_type=target_type)

        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(target_label__icontains=q)
                | Q(detail__icontains=q)
                | Q(actor__username__icontains=q)
            )

        days = self.request.query_params.get("days")
        if days:
            try:
                since = timezone.now() - timedelta(days=min(int(days), 365))
                qs = qs.filter(created_at__gte=since)
            except (TypeError, ValueError):
                pass
        return qs.order_by("-created_at")


@extend_schema(tags=["审计日志"])
class AuditLogStatsView(generics.GenericAPIView):
    """审计日志统计卡片数据（今日总数 / 登录次数 / 配置变更次数），条件与列表一致."""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = AuditLog.objects.all()
        if user.role not in ("admin", "staff"):
            qs = qs.filter(actor=user)

        action = self.request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        target_type = self.request.query_params.get("target_type")
        if target_type:
            qs = qs.filter(target_type=target_type)
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(target_label__icontains=q)
                | Q(detail__icontains=q)
                | Q(actor__username__icontains=q)
            )
        days = self.request.query_params.get("days")
        if days:
            try:
                since = timezone.now() - timedelta(days=min(int(days), 365))
                qs = qs.filter(created_at__gte=since)
            except (TypeError, ValueError):
                pass
        return qs

    def get(self, request, *args, **kwargs):
        qs = self.get_queryset()
        now = timezone.localtime()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        today_count = qs.filter(created_at__gte=today_start).count()
        # Django ORM 一次性 annotate 三种 action 计数（仅需 1 条 SQL 子查询）
        agg = qs.aggregate(
            login_count=Count("id", filter=Q(action="login")),
            config_count=Count("id", filter=Q(action="config_change")),
        )
        return Response({
            "code": 0,
            "message": "ok",
            "data": {
                "todayCount": today_count,
                "loginCount": agg["login_count"] or 0,
                "configCount": agg["config_count"] or 0,
            },
        })
