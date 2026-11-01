"""Root URL configuration."""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("apps.users.urls")),
    path("api/v1/users/", include("apps.users.admin_urls")),
    path("api/v1/survey-areas/", include("apps.survey_areas.urls")),
    path("api/v1/devices/", include("apps.devices.urls")),
    path("api/v1/species/", include("apps.species.urls")),
    path("api/v1/records/", include("apps.records.urls")),
    path("api/v1/alerts/", include("apps.alerts.urls")),
    path("api/v1/recognize/", include("apps.recognize.urls")),
    path("api/v1/categories/", include("apps.categories.urls")),
    path("api/v1/models/", include("apps.models_app.urls")),
    path("api/v1/analytics/", include("apps.analytics.urls")),
    path("api/v1/feedback/", include("apps.feedback.urls")),
    path("api/v1/system-config/", include("apps.system_config.urls")),
    path("api/v1/inference/", include("apps.inference.urls")),
    path("api/v1/fusion/", include("apps.fusion.urls")),
    path("api/v1/training/", include("apps.training.urls")),
    # OpenAPI schema
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
