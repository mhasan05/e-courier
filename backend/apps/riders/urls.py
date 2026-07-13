from django.urls import path

from .views import (
    RiderDetailView,
    RiderDocumentsView,
    RiderListView,
    RiderMeView,
    RiderPasswordView,
    RiderStatusView,
)

urlpatterns = [
    path("riders/", RiderListView.as_view(), name="rider-list"),
    path("riders/me/", RiderMeView.as_view(), name="rider-me"),
    path("riders/<int:pk>/", RiderDetailView.as_view(), name="rider-detail"),
    path("riders/<int:pk>/status/", RiderStatusView.as_view(), name="rider-status"),
    path("riders/<int:pk>/password/", RiderPasswordView.as_view(), name="rider-password"),
    path("riders/<int:pk>/documents/", RiderDocumentsView.as_view(), name="rider-documents"),
]
