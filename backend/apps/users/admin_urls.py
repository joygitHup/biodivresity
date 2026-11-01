"""Admin user management URL routes."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views.admin import UserAdminViewSet

router = DefaultRouter()
router.register("", UserAdminViewSet, basename="admin-user")

urlpatterns = [
    path("", include(router.urls)),
]
