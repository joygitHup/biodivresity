"""Audit logging helpers — 统一包装，避免各 view 重复 try/except."""
import logging
from typing import Optional

from django.utils import timezone

logger = logging.getLogger(__name__)


def _client_ip(request) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def audit(
    actor,
    action: str,
    target_type: str = "",
    target_id: Optional[int] = None,
    target_label: str = "",
    detail: str = "",
    request=None,
    ip: str = "",
) -> None:
    """best-effort 写一条审计日志，绝不抛异常影响主流程."""
    try:
        from apps.users.models import AuditLog  # 延迟 import 避免循环

        AuditLog.objects.create(
            actor=actor,
            action=action,
            target_type=target_type,
            target_id=target_id,
            target_label=target_label[:200] if target_label else "",
            detail=detail[:500] if detail else "",
            ip=ip or (_client_ip(request) if request else ""),
        )
    except Exception as exc:  # pragma: no cover
        logger.warning("audit log suppressed: %s", exc)


def audit_action(request, action: str, **kwargs) -> None:
    """方便在 view 里一行调用：audit_action(request, 'create', target_type='species', ...)."""
    return audit(actor=getattr(request, "user", None), request=request, action=action, **kwargs)
