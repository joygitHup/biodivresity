"""Custom user model with role field."""
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "管理员"
        STAFF = "staff", "农技人员"
        USER = "user", "普通用户"

    role = models.CharField(
        max_length=16,
        choices=Role.choices,
        default=Role.USER,
        verbose_name="角色",
    )
    phone = models.CharField(max_length=20, blank=True, verbose_name="手机号")
    avatar = models.URLField(blank=True, verbose_name="头像URL")


class AuditLog(models.Model):
    """轻量审计日志 — 记录关键操作行为."""

    class Action(models.TextChoices):
        LOGIN = "login", "登录"
        LOGOUT = "logout", "退出登录"
        CHANGE_PASSWORD = "change_password", "修改密码"
        UPDATE_PROFILE = "update_profile", "更新资料"
        CREATE = "create", "创建"
        UPDATE = "update", "更新"
        DELETE = "delete", "删除"
        REVIEW = "review", "复核"
        EXPORT = "export", "导出"
        CONFIG_CHANGE = "config_change", "修改配置"
        FORCE_CLOUD = "force_cloud", "强制上云"

    actor = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="audit_logs", verbose_name="操作人",
    )
    action = models.CharField(max_length=32, choices=Action.choices, verbose_name="操作")
    target_type = models.CharField(max_length=32, blank=True, verbose_name="对象类型")
    target_id = models.PositiveIntegerField(null=True, blank=True, verbose_name="对象ID")
    target_label = models.CharField(max_length=200, blank=True, verbose_name="对象名称")
    detail = models.CharField(max_length=500, blank=True, verbose_name="详情")
    ip = models.CharField(max_length=64, blank=True, verbose_name="IP")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="操作时间")

    class Meta:
        verbose_name = "审计日志"
        verbose_name_plural = verbose_name
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["actor", "-created_at"]),
            models.Index(fields=["action"]),
        ]

    def __str__(self):
        who = self.actor.username if self.actor else "系统"
        return f"[{self.created_at:%m-%d %H:%M}] {who} · {self.action}"
