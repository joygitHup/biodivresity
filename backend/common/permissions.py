"""Shared permission classes."""
from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    """Allow access only to admin users."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == "admin"
        )


class IsAdminOrStaff(BasePermission):
    """Allow access to admin or staff role."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = getattr(request.user, "role", None)
        return role in ("admin", "staff") or request.user.is_staff
