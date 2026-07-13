from django.urls import path

from .views import PickupRequestListView

urlpatterns = [
    path("pickups/", PickupRequestListView.as_view(), name="pickup-list"),
]
