"""User serializers — split by scene per coding standard."""
from rest_framework import serializers
from ..models import User


class UserBriefSerializer(serializers.ModelSerializer):
    """Brief user info for nested display."""

    class Meta:
        model = User
        fields = ["id", "username", "role", "avatar"]


class UserDetailSerializer(serializers.ModelSerializer):
    """Full user detail."""

    class Meta:
        model = User
        fields = ["id", "username", "email", "phone", "role", "avatar", "date_joined"]
        read_only_fields = ["id", "date_joined"]


class RegisterSerializer(serializers.ModelSerializer):
    """User registration serializer."""
    password = serializers.CharField(write_only=True, min_length=6)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "password", "password2", "phone"]

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password2"):
            raise serializers.ValidationError("两次密码不一致")
        return attrs

    def create(self, validated_data):
        from django.contrib.auth import get_user_model
        UserModel = get_user_model()
        return UserModel.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    """Login request serializer."""
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class UserAdminListSerializer(serializers.ModelSerializer):
    """Admin user list/detail serializer."""

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "phone", "role",
            "is_active", "last_login", "date_joined",
        ]
        read_only_fields = ["id", "last_login", "date_joined"]


class UserAdminWriteSerializer(serializers.ModelSerializer):
    """Admin user create/update serializer."""
    password = serializers.CharField(write_only=True, min_length=6, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["username", "email", "phone", "role", "is_active", "password"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        user.set_password(password or "123456")
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class TokenResponseSerializer(serializers.Serializer):
    """Token response structure (used for schema)."""
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserDetailSerializer()
