from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import TrainingReportViewSet, TrainingRunViewSet

router = DefaultRouter()
router.register("runs", TrainingRunViewSet, basename="training-run")
router.register("reports", TrainingReportViewSet, basename="training-report")

urlpatterns = [path("", include(router.urls))]
