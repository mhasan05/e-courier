from django.urls import path

from .views import (
    TicketDetailView,
    TicketListView,
    TicketMessageView,
    TicketReadView,
)

urlpatterns = [
    path("support/tickets/", TicketListView.as_view(), name="ticket-list"),
    path("support/tickets/<int:pk>/", TicketDetailView.as_view(), name="ticket-detail"),
    path("support/tickets/<int:pk>/messages/", TicketMessageView.as_view(), name="ticket-message"),
    path("support/tickets/<int:pk>/read/", TicketReadView.as_view(), name="ticket-read"),
]
