"""DRF ViewSet mixin — 自动审计 create / update / delete / 自定义 action."""
from rest_framework import viewsets

from apps.users.audit import audit_action


class AuditModelViewSetMixin:
    """
    混入后，ModelViewSet 的 create/update/destroy 会自动写审计日志。
    子类可覆盖 audit_target(obj) / audit_label(obj) 自定义字段。
    """

    # 子类可显式声明自己的 target_type，否则用 model.__name__.lower()
    audit_target_type: str | None = None

    def audit_target_label(self, obj) -> str:
        """返回对象的可读名称（取 name / title / chinese_name / __str__ 兜底）."""
        for field in ("name", "title", "chinese_name", "species_name"):
            if hasattr(obj, field):
                v = getattr(obj, field)
                if v:
                    return str(v)
        return str(obj)

    def _label(self) -> str:
        return self.audit_target_type or self.queryset.model.__name__.lower()

    # ── 覆写 DRF 的 perform_* 钩子 ──────────────────────────

    def perform_create(self, serializer):
        super().perform_create(serializer)
        obj = serializer.instance
        audit_action(
            self.request, "create",
            target_type=self._label(),
            target_id=obj.pk,
            target_label=self.audit_target_label(obj),
            detail=f"创建 {self._label()}",
        )

    def perform_update(self, serializer):
        before = self.get_object()
        super().perform_update(serializer)
        obj = serializer.instance
        audit_action(
            self.request, "update",
            target_type=self._label(),
            target_id=obj.pk,
            target_label=self.audit_target_label(obj),
            detail=f"更新 {self._label()}，原名称 {self.audit_target_label(before)}",
        )

    def perform_destroy(self, instance):
        label = self.audit_target_label(instance)
        pk = instance.pk
        super().perform_destroy(instance)
        audit_action(
            self.request, "delete",
            target_type=self._label(),
            target_id=pk,
            target_label=label,
            detail=f"删除 {self._label()}",
        )
