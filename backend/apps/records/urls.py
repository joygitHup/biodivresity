from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MonitorRecordViewSet

router = DefaultRouter()
router.register(r"", MonitorRecordViewSet, basename="record")

urlpatterns = [path("", include(router.urls))]
