from django.urls import path

from .views import (
    BranchCodSummaryView,
    CashInHandView,
    HubRemittanceConfirmView,
    HubRemittanceListView,
    RiderHandoverConfirmView,
    RiderHandoverListView,
)

urlpatterns = [
    path("cod/handovers/", RiderHandoverListView.as_view(), name="handover-list"),
    path("cod/handovers/<int:pk>/confirm/", RiderHandoverConfirmView.as_view(), name="handover-confirm"),
    path("cod/cash-in-hand/", CashInHandView.as_view(), name="cash-in-hand"),
    path("cod/remittances/", HubRemittanceListView.as_view(), name="remittance-list"),
    path("cod/remittances/<int:pk>/confirm/", HubRemittanceConfirmView.as_view(), name="remittance-confirm"),
    path("cod/summary/", BranchCodSummaryView.as_view(), name="cod-summary"),
]
