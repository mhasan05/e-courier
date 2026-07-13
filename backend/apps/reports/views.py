from datetime import timedelta

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.views import BaseAPIView
from apps.cod.services import cash_in_hand_parcels
from apps.merchants.models import Merchant
from apps.parcels.models import Parcel
from apps.parcels.scoping import scope_parcels
from apps.parcels.services import collected_cod_of
from apps.support.models import SupportTicket

ONGOING = ["pending", "picked_up", "in_transit", "out_for_delivery"]


def _status_breakdown(qs):
    rows = qs.values("status").annotate(n=Count("id"))
    return {r["status"]: r["n"] for r in rows}


def _daily_volume(qs, days=7):
    today = timezone.localdate()
    start = today - timedelta(days=days - 1)
    rows = (
        qs.filter(created_at__gte=start)
        .values("created_at")
        .annotate(n=Count("id"))
    )
    by_date = {r["created_at"].isoformat(): r["n"] for r in rows}
    return [
        {"date": (start + timedelta(days=i)).isoformat(),
         "count": by_date.get((start + timedelta(days=i)).isoformat(), 0)}
        for i in range(days)
    ]


class DashboardView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        role = user.role
        scoped = scope_parcels(user, Parcel.objects.all())
        today = timezone.localdate()

        data = {
            "role": role,
            "totalParcels": scoped.count(),
            "statusBreakdown": _status_breakdown(scoped),
            "dailyVolume": _daily_volume(scoped),
            "deliveredToday": scoped.filter(status="delivered", created_at=today).count(),
            "ongoing": scoped.filter(status__in=ONGOING).count(),
        }

        if role in ("admin", "super_admin"):
            data["activeMerchants"] = Merchant.objects.filter(status="active").count()
            data["pendingCod"] = Merchant.objects.aggregate(s=Sum("cod_pending"))["s"] or 0
            data["openTickets"] = SupportTicket.objects.filter(
                status__in=["open", "in_progress"]
            ).count()
        elif role == "merchant":
            merchant = getattr(user, "merchant", None)
            if merchant:
                data["balance"] = merchant.cod_pending
                data["codPending"] = merchant.cod_pending
                data["cancelled"] = scoped.filter(status="cancelled").count()
        elif role == "branch_manager":
            data["openTickets"] = 0
            data["riders"] = user.branch.riders.count() if user.branch_id else 0
        elif role == "delivery_man":
            rider = getattr(user, "delivery_man", None)
            if rider:
                parcels = cash_in_hand_parcels(rider.id)
                data["cashInHand"] = sum(collected_cod_of(p) for p in parcels)
                data["toPickUp"] = scoped.filter(status="pending").count()
                data["toDeliver"] = scoped.filter(status__in=["picked_up", "in_transit", "out_for_delivery"]).count()
                data["delivered"] = scoped.filter(status__in=["delivered", "partially_delivered"]).count()

        return Response(data)
