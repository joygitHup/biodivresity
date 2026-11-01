from django.apps import AppConfig


class ModelsAppConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.models_app"
    verbose_name = "模型版本管理"
