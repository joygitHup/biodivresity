"""Base settings for biodiversity backend."""
import sys
from pathlib import Path
import environ

env = environ.Env()

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = env("SECRET_KEY", default="django-insecure-dev-key-change-in-production")

DEBUG = env.bool("DEBUG", default=False)

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["*"])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    # Local apps
    "apps.users",
    "apps.survey_areas",
    "apps.devices",
    "apps.species",
    "apps.records",
    "apps.alerts",
    "apps.recognize",
    "apps.categories",
    "apps.models_app",
    "apps.analytics",
    "apps.feedback",
    "apps.system_config",
    "apps.inference",
    "apps.fusion",
    "apps.training",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "common.middleware.RequestIDMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database — default SQLite for dev, override via env
DATABASES = {
    "default": env.db_url("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}")
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 6}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTH_USER_MODEL = "users.User"

LANGUAGE_CODE = "zh-hans"
TIME_ZONE = "Asia/Shanghai"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# ── MinIO 对象存储 ────────────────────────────────────────────
# 设备拍摄的照片/视频/音频、以及用户上传的物种照片统一存到 MinIO
# 单元测试默认使用本地存储，避免依赖 MinIO 服务
MINIO_ENABLED = env.bool("MINIO_ENABLED", default="test" not in sys.argv)
# MinIO S3 API 端口为 9000（9001 是 Console，不能用于 S3 请求）
# 推理服务已改用 9008，不再占用 9000
MINIO_ENDPOINT = env("MINIO_ENDPOINT", default="localhost:9000")
MINIO_ACCESS_KEY = env("MINIO_ACCESS_KEY", default="Admin")
MINIO_SECRET_KEY = env("MINIO_SECRET_KEY", default="Admin123")
MINIO_BUCKET = env("MINIO_BUCKET", default="biodiversity")
MINIO_SECURE = env.bool("MINIO_SECURE", default=False)
# 对外可访问的地址前缀，默认与 endpoint 相同（本地演示用）
MINIO_PUBLIC_BASE_URL = env("MINIO_PUBLIC_BASE_URL", default="http://localhost:9000")

STORAGES = {
    "default": {
        "BACKEND": (
            "common.minio_storage.MinioStorage" if MINIO_ENABLED
            else "django.core.files.storage.FileSystemStorage"
        ),
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# 缓存 — Redis 兼作缓存后端（db 2，与 broker/result 隔离）；测试环境用本地内存
if "test" in sys.argv:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
else:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": env("REDIS_CACHE_URL", default="redis://127.0.0.1:6379/2"),
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
                # Redis 不可用时降级为缓存 miss 直查数据库，不影响业务
                "IGNORE_EXCEPTIONS": True,
            },
            "KEY_PREFIX": "biodiv",
            "TIMEOUT": 300,
        }
    }
DJANGO_REDIS_IGNORE_EXCEPTIONS = True

# DRF
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "common.pagination.StandardPagination",
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_RENDERER_CLASSES": (
        "common.renderers.StandardRenderer",
    ),
    "EXCEPTION_HANDLER": "common.exceptions.standard_exception_handler",
}

# JWT
from datetime import timedelta
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

# CORS
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:3000", "http://127.0.0.1:3000"],
)
CORS_ALLOW_CREDENTIALS = True

# drf-spectacular
SPECTACULAR_SETTINGS = {
    "TITLE": "生物多样性智慧监测平台 API",
    "DESCRIPTION": "天空地一体化生物多样性监测平台后端接口文档",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": r"/api/v[0-9]+/",
}

# Upload limits
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

# 推理服务（Provider 可插拔：mock / http）
INFERENCE_PROVIDER = env("INFERENCE_PROVIDER", default="mock")
INFERENCE_BASE_URL = env("INFERENCE_BASE_URL", default="")
INFERENCE_TOKEN = env("INFERENCE_TOKEN", default="")
INFERENCE_TIMEOUT = env.int("INFERENCE_TIMEOUT", default=30)
INFERENCE_BACKLOG_THRESHOLD = env.int("INFERENCE_BACKLOG_THRESHOLD", default=500)
# 文件传递方式：file(multipart 直传) / url(传媒体URL) / path(传本地路径)
INFERENCE_INPUT_MODE = env("INFERENCE_INPUT_MODE", default="file")
INFERENCE_MEDIA_BASE_URL = env("INFERENCE_MEDIA_BASE_URL", default="")
# 边缘端轻量模型后端：edge（内置模拟）/ mock / http
EDGE_PROVIDER = env("EDGE_PROVIDER", default="edge")

# 声学质量评估（VAD + 信噪比 + 分离质量）
AUDIO_FRAME_MS = env.int("AUDIO_FRAME_MS", default=25)
AUDIO_HOP_MS = env.int("AUDIO_HOP_MS", default=10)
AUDIO_VAD_DB = env.float("AUDIO_VAD_DB", default=-45)
AUDIO_ZCR_MAX = env.float("AUDIO_ZCR_MAX", default=0.8)
AUDIO_VAD_BACKEND = env("AUDIO_VAD_BACKEND", default="energy")  # energy / silero
AUDIO_VAD_SATURATION_RATIO = env.float("AUDIO_VAD_SATURATION_RATIO", default=0.3)
AUDIO_MIN_VAD_RATIO = env.float("AUDIO_MIN_VAD_RATIO", default=0.05)
AUDIO_MIN_SNR_DB = env.float("AUDIO_MIN_SNR_DB", default=5)
AUDIO_MIN_SEPARATION = env.float("AUDIO_MIN_SEPARATION", default=0.4)
AUDIO_MAX_OVERLAP = env.float("AUDIO_MAX_OVERLAP", default=0.6)
AUDIO_RELIABILITY_THRESHOLD = env.float("AUDIO_RELIABILITY_THRESHOLD", default=0.5)
AUDIO_DEGRADED_THRESHOLD = env.float("AUDIO_DEGRADED_THRESHOLD", default=0.75)

# 声源分离质量来源：provider 用推理服务返回值；http/local 为预留后端
AUDIO_SEPARATION_MODE = env("AUDIO_SEPARATION_MODE", default="provider")
AUDIO_SEPARATION_ENDPOINT = env("AUDIO_SEPARATION_ENDPOINT", default="")
AUDIO_SEPARATION_MODEL = env("AUDIO_SEPARATION_MODEL", default="")
AUDIO_SEPARATION_TIMEOUT = env.int("AUDIO_SEPARATION_TIMEOUT", default=15)

# Celery 任务队列
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://127.0.0.1:6379/0")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://127.0.0.1:6379/1")
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TIME_LIMIT = 300
CELERY_TASK_SOFT_TIME_LIMIT = 240
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_ACKS_LATE = True

# 队列拆分：识别/训练/融合独立队列，避免长任务阻塞短任务。
# 开发环境单 worker 需启动为：celery -A config worker -Q celery,identify,training,fusion --pool=solo
# 生产环境可按队列拆多个 worker 并使用 --pool=prefork -c 4~8
from kombu import Queue  # noqa: E402

CELERY_TASK_QUEUES = (
    Queue("celery"),
    Queue("identify"),
    Queue("training"),
    Queue("fusion"),
)
CELERY_TASK_ROUTES = {
    "inference.*": {"queue": "identify"},
    "training.*": {"queue": "training"},
    "fusion.*": {"queue": "fusion"},
}

# 大文件临时目录（音频分析/视频抽帧/训练打包），可指向 SSD 路径提升 IO
BIODIV_TMP_DIR = env("BIODIV_TMP_DIR", default="")

CELERY_BEAT_SCHEDULE = {
    "inference-recover-pending": {
        "task": "inference.recover_pending_tasks",
        "schedule": 120.0,
    },
    "inference-scan-stuck": {
        "task": "inference.scan_stuck_tasks",
        "schedule": 300.0,
    },
    "inference-check-backlog": {
        "task": "inference.check_backlog",
        "schedule": 300.0,
    },
    "fusion-rebuild-recent": {
        "task": "fusion.rebuild_recent_clusters",
        # 每分钟检查一次，实际间隔由 fusion_rebuild_interval_minutes 运行时配置
        "schedule": 60.0,
    },
    "records-backfill-training-samples": {
        "task": "records.backfill_training_samples",
        # 每小时补登记历史已确认记录，幂等可重复执行
        "schedule": 3600.0,
    },
    "media-cleanup-daily": {
        "task": "common.cleanup_media",
        "schedule": 86400.0,  # 每天一次
    },
}
