from rest_framework import serializers
from .models import Feedback


class FeedbackCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = [
            "recognize_record", "correctness",
            "suggested_category_id", "suggested_category_name", "comment",
        ]


class FeedbackListSerializer(serializers.ModelSerializer):
    userName = serializers.CharField(source="user.username", default="")

    class Meta:
        model = Feedback
        fields = [
            "id", "recognize_record", "correctness",
            "suggested_category_name", "review_status",
            "userName", "created_at",
        ]


class FeedbackReviewSerializer(serializers.Serializer):
    review_status = serializers.ChoiceField(choices=Feedback.ReviewStatus.choices)
    comment = serializers.CharField(required=False, allow_blank=True)
