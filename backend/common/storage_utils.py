"""存储工具：兼容本地文件与 MinIO 等远程对象存储。

对象存储上的文件没有本地路径，需要先下载到临时文件再交给
音频分析、路径模式推理等依赖真实路径的组件使用。
"""
from __future__ import annotations

import os
import shutil
import tempfile
from contextlib import contextmanager

from django.conf import settings
from django.core.files.storage import default_storage

# 大文件拷贝缓冲：默认 64KB 对大视频会产生大量系统调用，提高到 4MB
COPY_BUFFER_SIZE = 4 * 1024 * 1024


@contextmanager
def local_copy(name: str):
    """把存储中的文件准备好，产出本地路径；远程存储时用完自动清理。"""
    path = None
    try:
        path = default_storage.path(name)
    except (NotImplementedError, AttributeError, ValueError, OSError):
        path = None

    if path and os.path.exists(path):
        yield path
        return

    # 远程存储：下载到临时目录（BIODIV_TMP_DIR 可指向 SSD 路径提升 IO）
    suffix = os.path.splitext(name)[1]
    tmp_root = getattr(settings, "BIODIV_TMP_DIR", "") or None
    tmp_dir = tempfile.mkdtemp(prefix="biodiv-", dir=tmp_root)
    tmp_path = os.path.join(tmp_dir, f"source{suffix}")
    try:
        with default_storage.open(name, "rb") as src, open(tmp_path, "wb") as dst:
            shutil.copyfileobj(src, dst, length=COPY_BUFFER_SIZE)
        yield tmp_path
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
