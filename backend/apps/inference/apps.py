from django.apps import AppConfig


class InferenceAppConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.inference"
    verbose_name = "识别任务编排"
