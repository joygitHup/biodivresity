"""MinIO 对象存储后端：把设备媒体与上传文件保存到 MinIO/S3。

设计要点：
- Bucket 首次使用时自动创建，并设置为匿名只读，便于前端直接访问图片/音频/视频
- url() 返回可直接访问的公网地址（不走预签名，避免链接过期）
- 未配置 MinIO 时沿用 Django 本地文件存储
"""
from __future__ import annotations

import mimetypes
import posixpath
from urllib.parse import quote

from django.conf import settings
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible
from minio import Minio
from minio.error import S3Error


@deconstructible
class MinioStorage(Storage):
    """基于 minio-py 的 Django Storage 实现。"""

    def __init__(self):
        self.endpoint = settings.MINIO_ENDPOINT
        self.access_key = settings.MINIO_ACCESS_KEY
        self.secret_key = settings.MINIO_SECRET_KEY
        self.bucket = settings.MINIO_BUCKET
        self.secure = settings.MINIO_SECURE
        self.public_base_url = (settings.MINIO_PUBLIC_BASE_URL or "").rstrip("/")
        self._client: Minio | None = None
        self._bucket_ready = False

    # ── 内部工具 ────────────────────────────────────────────
    @property
    def client(self) -> Minio:
        if self._client is None:
            self._client = Minio(
                self.endpoint,
                access_key=self.access_key,
                secret_key=self.secret_key,
                secure=self.secure,
            )
        return self._client

    def _ensure_bucket(self) -> None:
        if self._bucket_ready:
            return
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)
        # 匿名只读策略：前端 <img>/<video> 可直接访问
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{self.bucket}/*"],
                }
            ],
        }
        import json

        self.client.set_bucket_policy(self.bucket, json.dumps(policy))
        self._bucket_ready = True

    @staticmethod
    def _normalize(name: str) -> str:
        name = name.replace("\\", "/").lstrip("/")
        return posixpath.normpath(name)

    # ── Storage API ─────────────────────────────────────────
    def _open(self, name, mode="rb"):
        self._ensure_bucket()
        response = self.client.get_object(self.bucket, self._normalize(name))
        try:
            data = response.read()
        finally:
            response.close()
            response.release_conn()
        from django.core.files import File
        import io

        return File(io.BytesIO(data), name=name)

    def _save(self, name, content):
        self._ensure_bucket()
        key = self._normalize(name)
        content_type = (
            getattr(content, "content_type", None)
            or mimetypes.guess_type(key)[0]
            or "application/octet-stream"
        )
        size = content.size
        self.client.put_object(
            self.bucket, key, content, length=size, content_type=content_type,
        )
        return key

    def exists(self, name):
        self._ensure_bucket()
        try:
            self.client.stat_object(self.bucket, self._normalize(name))
            return True
        except S3Error:
            return False

    def delete(self, name):
        self._ensure_bucket()
        try:
            self.client.remove_object(self.bucket, self._normalize(name))
        except S3Error:
            pass

    def size(self, name):
        self._ensure_bucket()
        return self.client.stat_object(self.bucket, self._normalize(name)).size

    def url(self, name):
        key = self._normalize(name)
        base = self.public_base_url
        if not base:
            scheme = "https" if self.secure else "http"
            base = f"{scheme}://{self.endpoint}"
        return f"{base}/{self.bucket}/{quote(key, safe='/')}"

    def get_available_name(self, name, max_length=None):
        # 对象存储允许同名覆盖，保留原始文件名便于追溯
        if max_length and len(name) > max_length:
            name = name[:max_length]
        return name


def minio_enabled() -> bool:
    return bool(getattr(settings, "MINIO_ENABLED", False))
