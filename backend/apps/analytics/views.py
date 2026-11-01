"""Aggregated analytics endpoints — no write operations, no models, pure DB aggregation."""
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.survey_areas.models import SurveyArea
from apps.devices.models import Device
from apps.species.models import Species
from apps.records.models import MonitorRecord
from apps.alerts.models import Alert


@extend_schema(tags=["统计分析"], summary="看板核心统计")
class DashboardStatsView(APIView):
    permission_classes = []  # Allow basic stats

    def get(self, request):
        today = timezone.now().date()
        week_ago = timezone.now() - timedelta(days=7)

        data = {
            "totalSpecies": Species.objects.count(),
            "totalRecords": MonitorRecord.objects.count(),
            "activeDevices": Device.objects.online().count(),
            "surveyAreas": SurveyArea.objects.active().count(),
            "pendingReviews": MonitorRecord.objects.pending_review().count(),
            "activeAlerts": Alert.objects.unread().count(),
            "todayRecords": MonitorRecord.objects.filter(timestamp__date=today).count(),
            "weekRecords": MonitorRecord.objects.filter(timestamp__gte=week_ago).count(),
        }
        return Response({"code": 0, "message": "ok", "data": data})


@extend_schema(tags=["统计分析"], summary="月度监测记录趋势")
class MonthlyTrendView(APIView):
    def get(self, request):
        from django.db.models.functions import TruncMonth
        qs = (
            MonitorRecord.objects
            .annotate(month=TruncMonth("timestamp"))
            .values("month")
            .annotate(records=Count("id"))
            .order_by("month")[:12]
        )
        data = []
        for item in qs:
            m = item["month"]
            data.append({"month": f"{m.month}月", "records": item["records"]})
        return Response({"code": 0, "message": "ok", "data": data})


@extend_schema(tags=["统计分析"], summary="作物类别组成")
class SpeciesCategoryView(APIView):
    def get(self, request):
        qs = (
            Species.objects
            .values("crop")
            .annotate(value=Count("id"))
            .order_by("-value")
        )
        label_map = {c[0]: c[1] for c in Species.Crop.choices}
        data = [{"name": label_map.get(item["crop"], item["crop"]), "value": item["value"]} for item in qs]
        return Response({"code": 0, "message": "ok", "data": data})


@extend_schema(tags=["统计分析"], summary="最新监测记录")
class RecentRecordsView(APIView):
    def get(self, request):
        limit = int(request.query_params.get("limit", 10))
        qs = MonitorRecord.objects.select_related("device", "survey_area", "species").order_by("-timestamp")[:limit]
        from apps.records.serializers import MonitorRecordListSerializer
        serializer = MonitorRecordListSerializer(qs, many=True)
        return Response({"code": 0, "message": "ok", "data": serializer.data})


@extend_schema(tags=["统计分析"], summary="最新预警")
class RecentAlertsView(APIView):
    def get(self, request):
        limit = int(request.query_params.get("limit", 10))
        qs = Alert.objects.select_related("survey_area").order_by("-created_at")[:limit]
        from apps.alerts.serializers import AlertListSerializer
        serializer = AlertListSerializer(qs, many=True)
        return Response({"code": 0, "message": "ok", "data": serializer.data})


@extend_schema(tags=["统计分析"], summary="设备状态概览")
class DeviceOverviewView(APIView):
    def get(self, request):
        data = {
            "total": Device.objects.count(),
            "online": Device.objects.filter(status="online").count(),
            "offline": Device.objects.filter(status="offline").count(),
            "warning": Device.objects.filter(status="warning").count(),
        }
        return Response({"code": 0, "message": "ok", "data": data})


@extend_schema(tags=["统计分析"], summary="相对发生频度 — 病虫害类别频次 Top")
class RaiIndexView(APIView):
    """病虫害相对发生频度 (Relative Activity Index) — 按最近 7 天记录频次排序."""

    def get(self, request):
        days = int(request.query_params.get("days", 7))
        top = int(request.query_params.get("top", 6))
        since = timezone.now() - timedelta(days=min(days, 365))

        from django.db.models import Sum
        qs = (
            MonitorRecord.objects.filter(timestamp__gte=since)
            .exclude(species__isnull=True)
            .values("species_id", "species__chinese_name")
            .annotate(rai=Sum("count"))
            .order_by("-rai")[:top]
        )
        data = [
            {"species": item["species__chinese_name"], "rai": float(item["rai"] or 0)}
            for item in qs
        ]
        # 数据不足时补占位，保证图表不空
        if not data:
            data = [
                {"species": "暂无数据", "rai": 0},
            ]
        return Response({"code": 0, "message": "ok", "data": data})


@extend_schema(tags=["统计分析"], summary="发生节律 — 按小时聚合监测记录")
class ActivityRhythmView(APIView):
    """按 24 小时聚合最近 7 天的监测记录，反映病虫害发生的时间节律."""

    def get(self, request):
        days = int(request.query_params.get("days", 7))
        since = timezone.now() - timedelta(days=min(days, 365))

        from django.db.models.functions import ExtractHour
        qs = (
            MonitorRecord.objects.filter(timestamp__gte=since)
            .annotate(h=ExtractHour("timestamp"))
            .values("h")
            .annotate(count=Count("id"))
        )
        hour_map = {item["h"]: item["count"] for item in qs if item["h"] is not None}
        labels = ["0时", "2时", "4时", "6时", "8时", "10时", "12时", "14时", "16时", "18时", "20时", "22时"]
        hours_set = {0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22}
        data = []
        for h in sorted(hours_set):
            # 把 23 点计入 22 点档
            bucket = hour_map.get(h, 0) + (hour_map.get(h + 1, 0) if h + 1 not in hours_set else 0)
            data.append({"hour": labels[h // 2], "count": bucket})
        return Response({"code": 0, "message": "ok", "data": data})
