from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views.auth import RegisterView, LoginView, ProfileView, ChangePasswordView
from .views.audit import AuditLogListView, AuditLogStatsView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("profile/", ProfileView.as_view(), name="profile"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("audit-logs/", AuditLogListView.as_view(), name="audit-logs"),
    path("audit-logs/stats/", AuditLogStatsView.as_view(), name="audit-logs-stats"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
]

router = DefaultRouter()
urlpatterns += router.urls
