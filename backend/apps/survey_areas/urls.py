from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SurveyAreaViewSet

router = DefaultRouter()
router.register(r"", SurveyAreaViewSet, basename="survey-area")

urlpatterns = [path("", include(router.urls))]
