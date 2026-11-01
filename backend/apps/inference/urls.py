from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    EdgeReportView,
    InferenceStatsView,
    IngestView,
    MediaAssetViewSet,
    PredictionTaskViewSet,
    ProviderHealthView,
    SchedulingStatsView,
    ThresholdAuditListView,
)

router = DefaultRouter()
router.register("tasks", PredictionTaskViewSet, basename="inference-task")
router.register("assets", MediaAssetViewSet, basename="inference-asset")

urlpatterns = [
    path("ingest/", IngestView.as_view(), name="inference-ingest"),
    path("stats/", InferenceStatsView.as_view(), name="inference-stats"),
    path("scheduling/stats/", SchedulingStatsView.as_view(), name="inference-scheduling-stats"),
    path("edge/report/", EdgeReportView.as_view(), name="inference-edge-report"),
    path("provider-health/", ProviderHealthView.as_view(), name="inference-provider-health"),
    path("threshold-audits/", ThresholdAuditListView.as_view(), name="threshold-audits"),
    path("", include(router.urls)),
]
