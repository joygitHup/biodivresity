from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ModelVersionViewSet

router = DefaultRouter()
router.register(r"", ModelVersionViewSet, basename="model-version")

urlpatterns = [path("", include(router.urls))]
