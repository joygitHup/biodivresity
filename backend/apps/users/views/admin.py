"""Admin user management views."""
from django.contrib.auth import get_user_model
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view

from common.permissions import IsAdminRole
from ..serializers.user import (
    UserAdminListSerializer,
    UserAdminWriteSerializer,
)

User = get_user_model()


@extend_schema_view(
    list=extend_schema(summary="用户列表(管理员)"),
    retrieve=extend_schema(summary="用户详情(管理员)"),
    create=extend_schema(summary="创建用户(管理员)"),
    update=extend_schema(summary="更新用户(管理员)"),
    partial_update=extend_schema(summary="部分更新用户(管理员)"),
    destroy=extend_schema(summary="删除用户(管理员)"),
)
class UserAdminViewSet(viewsets.ModelViewSet):
    """管理员用户管理接口."""

    queryset = User.objects.all().order_by("-date_joined")
    permission_classes = [IsAdminRole]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["role", "is_active"]
    search_fields = ["username", "email", "phone"]
    ordering_fields = ["date_joined", "last_login"]

    def get_serializer_class(self):
        if self.action in ["list", "retrieve"]:
            return UserAdminListSerializer
        return UserAdminWriteSerializer

    def create(self, request, *args, **kwargs):
        # 输入用 WriteSerializer，输出用 ListSerializer 返回完整对象（含 id）
        serializer = UserAdminWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            UserAdminListSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = UserAdminWriteSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(UserAdminListSerializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.id == request.user.id:
            return Response(
                {"code": 40001, "message": "不能删除当前登录账号"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @extend_schema(summary="重置用户密码(管理员)")
    @action(detail=True, methods=["post"])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        new_password = request.data.get("password", "")
        if len(new_password) < 6:
            return Response(
                {"code": 40001, "message": "密码长度至少6位"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"code": 0, "message": "ok", "data": {"id": user.id}})
