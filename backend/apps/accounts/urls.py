from django.urls import path

from .views import (
    AvatarView,
    ChangePasswordView,
    LoginView,
    ManagerDetailView,
    ManagerListCreateView,
    MeView,
    RefreshView,
)

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/refresh/", RefreshView.as_view(), name="refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("auth/avatar/", AvatarView.as_view(), name="avatar"),
    path("accounts/managers/", ManagerListCreateView.as_view(), name="manager-list"),
    path("accounts/managers/<int:pk>/", ManagerDetailView.as_view(), name="manager-detail"),
]
