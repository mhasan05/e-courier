from django.urls import path

from .views import PricingQuoteView, ZoneDetailView, ZoneListView

urlpatterns = [
    path("zones/", ZoneListView.as_view(), name="zone-list"),
    path("zones/<int:pk>/", ZoneDetailView.as_view(), name="zone-detail"),
    path("pricing/quote/", PricingQuoteView.as_view(), name="pricing-quote"),
]
