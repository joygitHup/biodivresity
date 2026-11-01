"""Auth service — business logic for registration/login."""
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from ..models import User


def authenticate_user(username, password):
    """Authenticate user by credentials, returns user or None."""
    return authenticate(username=username, password=password)


def generate_tokens(user: User) -> dict:
    """Generate JWT tokens for user."""
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }
