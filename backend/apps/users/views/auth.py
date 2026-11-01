"""Auth views — login/register/profile."""
from django.contrib.auth import get_user_model
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers
from drf_spectacular.utils import extend_schema

from ..serializers.user import (
    RegisterSerializer,
    LoginSerializer,
    UserDetailSerializer,
)
from ..services.auth import authenticate_user, generate_tokens

User = get_user_model()


@extend_schema(tags=["认证"])
class RegisterView(generics.CreateAPIView):
    """用户注册."""
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


@extend_schema(tags=["认证"])
class LoginView(APIView):
    """用户登录，返回 JWT 及用户信息."""
    permission_classes = [AllowAny]

    @extend_schema(request=LoginSerializer, responses={200: dict})
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate_user(
            serializer.validated_data["username"],
            serializer.validated_data["password"],
        )
        if user is None:
            return Response(
                {"code": 40101, "message": "用户名或密码错误"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        tokens = generate_tokens(user)
        user_data = UserDetailSerializer(user).data
        # 审计：登录
        from apps.users.audit import audit_action
        audit_action(request, "login", target_type="user", target_id=user.id, target_label=user.username, detail=f"{user.username} 登录系统")
        return Response({
            "code": 0,
            "message": "ok",
            "data": {**tokens, "user": user_data},
        })


@extend_schema(tags=["认证"])
class ProfileView(APIView):
    """获取 / 更新当前用户信息."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserDetailSerializer(request.user)
        return Response({"code": 0, "message": "ok", "data": serializer.data})

    def put(self, request):
        """更新个人资料（username/email/phone/avatar）."""
        user = request.user
        allowed = {"email", "phone", "avatar"}
        # 仅管理员 / 未占用时允许改 username
        data = request.data or {}
        for key in allowed:
            if key in data:
                setattr(user, key, data[key])
        if "username" in data and data["username"] != user.username:
            if User.objects.filter(username=data["username"]).exists():
                return Response(
                    {"code": 40001, "message": "用户名已被占用"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.username = data["username"]
        try:
            user.full_clean()
        except Exception as exc:
            return Response(
                {"code": 40001, "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.save()
        serializer = UserDetailSerializer(user)
        from apps.users.audit import audit_action
        audit_action(request, "update_profile", target_type="user", target_id=user.id, target_label=user.username, detail="更新了个人资料")
        return Response({"code": 0, "message": "ok", "data": serializer.data})


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(min_length=6)


@extend_schema(tags=["认证"])
class ChangePasswordView(APIView):
    """修改当前用户密码."""
    permission_classes = [IsAuthenticated]

    @extend_schema(request=ChangePasswordSerializer)
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data["old_password"]):
            return Response(
                {"code": 40002, "message": "原密码不正确"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(serializer.validated_data["new_password"])
        user.save()
        # 审计日志
        try:
            from apps.users.models import AuditLog
            AuditLog.objects.create(
                actor=user,
                action="change_password",
                target_type="user",
                target_id=user.id,
                detail="用户修改了密码",
                ip=self._client_ip(request),
            )
        except Exception:
            pass
        return Response({"code": 0, "message": "ok"})

    @staticmethod
    def _client_ip(request) -> str:
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")
