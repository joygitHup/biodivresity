from django.urls import path
from .views import (
    DashboardStatsView,
    MonthlyTrendView,
    SpeciesCategoryView,
    RecentRecordsView,
    RecentAlertsView,
    DeviceOverviewView,
    RaiIndexView,
    ActivityRhythmView,
)

urlpatterns = [
    path("dashboard/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("monthly-trend/", MonthlyTrendView.as_view(), name="monthly-trend"),
    path("species-category/", SpeciesCategoryView.as_view(), name="species-category"),
    path("recent-records/", RecentRecordsView.as_view(), name="recent-records"),
    path("recent-alerts/", RecentAlertsView.as_view(), name="recent-alerts"),
    path("devices/", DeviceOverviewView.as_view(), name="device-overview"),
    path("rai/", RaiIndexView.as_view(), name="rai-index"),
    path("rhythm/", ActivityRhythmView.as_view(), name="activity-rhythm"),
]
