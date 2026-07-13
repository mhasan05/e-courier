from django.urls import path

from .views import BranchDetailView, BranchListView, BranchToggleActiveView, MyCoverageView

urlpatterns = [
    path("branches/", BranchListView.as_view(), name="branch-list"),
    path("branches/my-coverage/", MyCoverageView.as_view(), name="branch-my-coverage"),
    path("branches/<int:pk>/", BranchDetailView.as_view(), name="branch-detail"),
    path("branches/<int:pk>/toggle-active/", BranchToggleActiveView.as_view(), name="branch-toggle"),
]
