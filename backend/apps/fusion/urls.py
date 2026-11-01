from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import EdnaEvidenceViewSet, EvidenceClusterViewSet

router = DefaultRouter()
router.register("clusters", EvidenceClusterViewSet, basename="fusion-cluster")
router.register("edna", EdnaEvidenceViewSet, basename="fusion-edna")

urlpatterns = [path("", include(router.urls))]
