from django.urls import path

from .views import (
    MerchantApiKeyDetailView,
    MerchantApiKeyListCreateView,
    MerchantAssignBranchView,
    MerchantDetailView,
    MerchantListView,
    MerchantMeView,
    MerchantRegisterView,
    MerchantStatusView,
    MerchantWebhookDeliveriesView,
    MerchantWebhookView,
)

urlpatterns = [
    path("auth/register/", MerchantRegisterView.as_view(), name="merchant-register"),
    path("merchants/", MerchantListView.as_view(), name="merchant-list"),
    path("merchants/me/", MerchantMeView.as_view(), name="merchant-me"),
    path("merchant/api-keys/", MerchantApiKeyListCreateView.as_view(), name="merchant-api-keys"),
    path("merchant/api-keys/<int:pk>/", MerchantApiKeyDetailView.as_view(), name="merchant-api-key-detail"),
    path("merchant/webhook/", MerchantWebhookView.as_view(), name="merchant-webhook"),
    path("merchant/webhook/deliveries/", MerchantWebhookDeliveriesView.as_view(), name="merchant-webhook-deliveries"),
    path("merchants/<int:pk>/", MerchantDetailView.as_view(), name="merchant-detail"),
    path("merchants/<int:pk>/status/", MerchantStatusView.as_view(), name="merchant-status"),
    path("merchants/<int:pk>/assign-branch/", MerchantAssignBranchView.as_view(), name="merchant-assign-branch"),
]
