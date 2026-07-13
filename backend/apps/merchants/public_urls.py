from django.urls import path

from .public_api import (
    BulkCreateOrderView,
    CoverageView,
    CreateOrderView,
    ParcelCancelView,
    ParcelDetailView,
    ParcelsView,
    QuoteView,
)

# Public merchant API, mounted at /api/merchant/v1/
urlpatterns = [
    # Steadfast-style order creation (documented surface).
    path("create_order", CreateOrderView.as_view(), name="mapi-create-order"),
    path("create_order/bulk-order", BulkCreateOrderView.as_view(), name="mapi-bulk-order"),
    # Existing JSON endpoints (kept for the dashboard/back-compat).
    path("parcels/", ParcelsView.as_view(), name="mapi-parcels"),
    path("parcels/<str:tracking_id>/", ParcelDetailView.as_view(), name="mapi-parcel-detail"),
    path("parcels/<str:tracking_id>/cancel/", ParcelCancelView.as_view(), name="mapi-parcel-cancel"),
    path("pricing/quote/", QuoteView.as_view(), name="mapi-quote"),
    path("coverage/", CoverageView.as_view(), name="mapi-coverage"),
]
