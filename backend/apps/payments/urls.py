from django.urls import path

from .views import (
    PaymentMethodDetailView,
    PaymentMethodListView,
    PaymentMethodToggleView,
    PayoutMethodDefaultView,
    PayoutMethodDetailView,
    PayoutMethodListView,
    WithdrawalListView,
    WithdrawalStatusView,
)

urlpatterns = [
    path("payment-methods/", PaymentMethodListView.as_view(), name="method-list"),
    path("payment-methods/<int:pk>/", PaymentMethodDetailView.as_view(), name="method-detail"),
    path("payment-methods/<int:pk>/toggle/", PaymentMethodToggleView.as_view(), name="method-toggle"),
    path("payout-methods/", PayoutMethodListView.as_view(), name="payout-list"),
    path("payout-methods/<int:pk>/", PayoutMethodDetailView.as_view(), name="payout-detail"),
    path("payout-methods/<int:pk>/default/", PayoutMethodDefaultView.as_view(), name="payout-default"),
    path("withdrawals/", WithdrawalListView.as_view(), name="withdrawal-list"),
    path("withdrawals/<int:pk>/status/", WithdrawalStatusView.as_view(), name="withdrawal-status"),
]
