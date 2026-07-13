from django.urls import path

from .views import DashboardView

urlpatterns = [
    path("reports/dashboard/", DashboardView.as_view(), name="dashboard"),
]
