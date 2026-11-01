from django.urls import path
from .views import RecognizeView, RecognizeRecordListView, RecognizeRecordDetailView

urlpatterns = [
    path("", RecognizeView.as_view(), name="recognize"),
    path("records/", RecognizeRecordListView.as_view(), name="recognize-records"),
    path("records/<int:pk>/", RecognizeRecordDetailView.as_view(), name="recognize-record-detail"),
]
