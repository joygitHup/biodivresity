"""Dev settings — extends base with debug-friendly overrides."""
from .base import *  # noqa: F401,F403

DEBUG = True

CORS_ALLOW_ALL_ORIGINS = True

# 推理服务：本地 Ultralytics 推理服务（backend/inference_service）
INFERENCE_PROVIDER = env("INFERENCE_PROVIDER", default="http")
INFERENCE_BASE_URL = env("INFERENCE_BASE_URL", default="http://127.0.0.1:9008")
INFERENCE_TIMEOUT = env.int("INFERENCE_TIMEOUT", default=60)
INFERENCE_INPUT_MODE = env("INFERENCE_INPUT_MODE", default="file")
INFERENCE_MEDIA_BASE_URL = env("INFERENCE_MEDIA_BASE_URL", default="http://127.0.0.1:8000")

# Console logging
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}
