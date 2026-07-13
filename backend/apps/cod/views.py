from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import IsAdmin, IsAdminOrBranchManager
from apps.common.views import BaseAPIView
from apps.parcels.models import Parcel
from apps.parcels.services import collected_cod_of

from .models import HubRemittance, RiderHandover, RemittanceStatus
from .serializers import HubRemittanceSerializer, RiderHandoverSerializer
from .services import cash_in_hand_parcels, next_reference


def _is_admin(user):
    return user.role in ("admin", "super_admin")


# ---------------- Rider → hub handovers ----------------

class RiderHandoverListView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = RiderHandover.objects.all()
        if user.role == "delivery_man":
            rider = getattr(user, "delivery_man", None)
            qs = qs.filter(rider_id=rider.id) if rider else qs.none()
        elif user.role == "branch_manager":
            qs = qs.filter(branch_id=user.branch_id)
        elif not _is_admin(user):
            qs = qs.none()
        page = self.paginate(qs, request)
        return self.paginated_response(page, RiderHandoverSerializer(page.object_list, many=True).data)

    def post(self, request):
        rider = getattr(request.user, "delivery_man", None)
        if rider is None:
            raise PermissionDenied("Only riders can hand over cash.")
        parcels = cash_in_hand_parcels(rider.id)
        if not parcels:
            return Response({"detail": "No cash in hand to hand over.", "errors": {}}, status=400)
        amount = sum(collected_cod_of(p) for p in parcels)
        handover = RiderHandover.objects.create(
            rider=rider,
            rider_name=rider.name,
            branch_id=rider.branch_id,
            amount=amount,
            parcel_count=len(parcels),
            parcel_ids=[p.id for p in parcels],
            reference=next_reference(RiderHandover, "RH"),
            status=RemittanceStatus.PENDING,
        )
        return Response(RiderHandoverSerializer(handover).data, status=201)


class RiderHandoverConfirmView(BaseAPIView):
    permission_classes = [IsAuthenticated, IsAdminOrBranchManager]

    def post(self, request, pk):
        handover = get_object_or_404(RiderHandover, pk=pk)
        if request.user.role == "branch_manager" and handover.branch_id != request.user.branch_id:
            raise PermissionDenied("This handover is not for your hub.")
        handover.status = RemittanceStatus.RECEIVED
        handover.received_at = timezone.localdate()
        handover.confirmed_by = request.user.name or request.user.email
        handover.save(update_fields=["status", "received_at", "confirmed_by"])
        return Response(RiderHandoverSerializer(handover).data)


class CashInHandView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rider = getattr(request.user, "delivery_man", None)
        if rider is None:
            raise PermissionDenied("Riders only.")
        parcels = cash_in_hand_parcels(rider.id)
        return Response({
            "amount": sum(collected_cod_of(p) for p in parcels),
            "parcelCount": len(parcels),
            "parcelIds": [p.id for p in parcels],
        })


# ---------------- Hub → HQ remittances ----------------

class HubRemittanceListView(BaseAPIView):
    permission_classes = [IsAuthenticated, IsAdminOrBranchManager]

    def get(self, request):
        qs = HubRemittance.objects.all()
        if request.user.role == "branch_manager":
            qs = qs.filter(branch_id=request.user.branch_id)
        page = self.paginate(qs, request)
        return self.paginated_response(page, HubRemittanceSerializer(page.object_list, many=True).data)

    def post(self, request):
        user = request.user
        if user.role == "branch_manager":
            branch_id = user.branch_id
        elif _is_admin(user):
            branch_id = request.data.get("branchId")
        else:
            raise PermissionDenied("Only hubs can remit.")
        amount = int(request.data.get("amount") or 0)
        if amount <= 0:
            return Response({"detail": "Amount must be positive.", "errors": {}}, status=400)
        delivered = Parcel.objects.filter(owner_branch_id=branch_id, status="delivered").count()
        remittance = HubRemittance.objects.create(
            branch_id=branch_id,
            amount=amount,
            parcel_count=delivered,
            reference=request.data.get("reference", "") or next_reference(HubRemittance, "RMT"),
            note=request.data.get("note", ""),
            status=RemittanceStatus.PENDING,
        )
        return Response(HubRemittanceSerializer(remittance).data, status=201)


class HubRemittanceConfirmView(BaseAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        remittance = get_object_or_404(HubRemittance, pk=pk)
        remittance.status = RemittanceStatus.RECEIVED
        remittance.received_at = timezone.localdate()
        remittance.save(update_fields=["status", "received_at"])
        return Response(HubRemittanceSerializer(remittance).data)


class BranchCodSummaryView(BaseAPIView):
    """Collected / sent / outstanding COD for a hub (branch manager or admin)."""

    permission_classes = [IsAuthenticated, IsAdminOrBranchManager]

    def get(self, request):
        if request.user.role == "branch_manager":
            branch_id = request.user.branch_id
        else:
            branch_id = request.query_params.get("branchId")
        if not branch_id:
            return Response({"detail": "branchId required.", "errors": {}}, status=400)

        delivered = Parcel.objects.filter(
            owner_branch_id=branch_id, status__in=["delivered", "partially_delivered"]
        )
        collected = sum(collected_cod_of(p) for p in delivered)
        sent = HubRemittance.objects.filter(branch_id=branch_id).aggregate(s=Sum("amount"))["s"] or 0
        return Response({
            "branchId": int(branch_id),
            "collected": collected,
            "sent": sent,
            "outstanding": max(0, collected - sent),
        })
