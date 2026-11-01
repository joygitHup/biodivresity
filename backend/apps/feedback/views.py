from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema_view, extend_schema

from .models import Feedback
from .serializers import FeedbackCreateSerializer, FeedbackListSerializer, FeedbackReviewSerializer
from common.permissions import IsAdminOrStaff


@extend_schema_view(
    list=extend_schema(summary="反馈列表"),
    retrieve=extend_schema(summary="反馈详情"),
    create=extend_schema(summary="提交反馈"),
)
class FeedbackViewSet(viewsets.ModelViewSet):
    queryset = Feedback.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["correctness", "review_status", "user"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return FeedbackCreateSerializer
        return FeedbackListSerializer

    def get_permissions(self):
        if self.action in ["review"]:
            return [IsAdminOrStaff()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @extend_schema(summary="农技人员复核反馈")
    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        feedback = self.get_object()
        ser = FeedbackReviewSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        feedback.review_status = ser.validated_data["review_status"]
        feedback.reviewed_by = request.user
        feedback.reviewed_at = timezone.now()
        feedback.save()
        return Response({"code": 0, "message": "ok"})
