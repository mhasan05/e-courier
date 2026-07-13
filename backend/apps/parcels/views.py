from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.common.otp import verify_otp
from apps.common.views import BaseAPIView
from apps.merchants.models import Merchant
from apps.riders.models import DeliveryMan

from apps.branches.models import Branch

from .models import Bag, BagStatus, Parcel, ParcelStatus, Trip
from .scoping import can_act_on, is_admin, scope_parcels
from .serializers import (
    BagSerializer,
    ParcelCreateSerializer,
    ParcelSerializer,
    StatusUpdateSerializer,
    TrackingSerializer,
    TripSerializer,
)
from apps.branches.routing import next_hop_branch_id

from .services import (
    accept_parcel,
    add_status_event,
    assign_rider,
    baggable_parcels_qs,
    book_parcel,
    build_bag,
    close_trip,
    dispatch_bag,
    dispatch_parcel,
    initiate_return,
    open_trip,
    parcel_next_hop,
    receive_bag,
    reject_parcel,
    submit_parcel_to_hub,
    trip_deliver,
    trip_fail,
    trip_pickup,
)
from apps.merchants.webhooks import fire_parcel_webhook
from .stats import recipient_stats

# Status transitions a rider may perform (constrained, unlike admin/branch).
RIDER_TRANSITIONS = {
    "pending": {"picked_up"},
    "picked_up": {"out_for_delivery", "in_transit"},
    "in_transit": {"out_for_delivery"},
    "out_for_delivery": {"delivered", "partially_delivered", "return_in_transit"},
}


def _actor_name(user):
    return user.name or user.email


def _scoped_parcel(request, pk):
    parcel = scope_parcels(request.user, Parcel.objects.all()).filter(pk=pk).first()
    if parcel is None:
        raise NotFound("Parcel not found.")
    return parcel


class ParcelListView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = scope_parcels(request.user, Parcel.objects.select_related("merchant", "delivery_man").all())
        status = request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        q = request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(tracking_id__icontains=q)
                | Q(recipient_name__icontains=q)
                | Q(recipient_phone__icontains=q)
            )
        page = self.paginate(qs, request)
        data = ParcelSerializer(page.object_list, many=True, context={"request": request}).data
        return self.paginated_response(page, data)

    def post(self, request):
        user = request.user
        if user.role == "merchant":
            merchant = getattr(user, "merchant", None)
            if merchant is None:
                raise PermissionDenied("No merchant profile.")
        elif is_admin(user):
            merchant = get_object_or_404(Merchant, pk=request.data.get("merchantId"))
        else:
            raise PermissionDenied("Only merchants or admins can book parcels.")

        ser = ParcelCreateSerializer(data=request.data, context={"merchant": merchant})
        ser.is_valid(raise_exception=True)
        parcel = ser.save()
        return Response(
            ParcelSerializer(parcel, context={"request": request}).data, status=201
        )


class ParcelDetailView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        parcel = _scoped_parcel(request, pk)
        return Response(ParcelSerializer(parcel, context={"request": request}).data)


class ParcelStatusView(BaseAPIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        parcel = _scoped_parcel(request, pk)
        if not can_act_on(request.user, parcel):
            raise PermissionDenied("You cannot modify this parcel.")

        ser = StatusUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        v = ser.validated_data
        new_status = v["status"]
        role = request.user.role

        # --- role-specific rules ---
        if role == "merchant":
            if not (parcel.status == "pending" and new_status == "cancelled"):
                raise PermissionDenied("Merchants can only cancel pending parcels.")
        elif role == "delivery_man":
            allowed = RIDER_TRANSITIONS.get(parcel.status, set())
            if new_status not in allowed:
                raise PermissionDenied(f"Riders cannot move {parcel.status} to {new_status}.")
            if new_status in ("delivered", "partially_delivered"):
                if not verify_otp(parcel.delivery_otp, v.get("otp", "")):
                    return Response({"detail": "Incorrect delivery OTP.", "errors": {}}, status=400)

        # --- COD collected on delivery ---
        if new_status == "delivered":
            parcel.collected_cod = parcel.cod_amount
        elif new_status == "partially_delivered":
            collected = v.get("collectedCod")
            if collected is None or collected <= 0 or collected > parcel.cod_amount:
                return Response(
                    {"detail": f"collectedCod must be between 1 and {parcel.cod_amount}.", "errors": {}},
                    status=400,
                )
            parcel.collected_cod = collected

        parcel.status = new_status
        parcel.save(update_fields=["status", "collected_cod"])
        add_status_event(
            parcel, new_status,
            remark=v.get("remark", ""), changed_by=_actor_name(request.user),
            proof_photo=v.get("proofPhoto"), proof_note=v.get("proofNote", ""),
        )
        fire_parcel_webhook(parcel)
        parcel.refresh_from_db()
        return Response(ParcelSerializer(parcel, context={"request": request}).data)


class ParcelAssignView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.role not in ("admin", "super_admin", "branch_manager"):
            raise PermissionDenied("Only admin or branch managers can assign riders.")
        parcel = _scoped_parcel(request, pk)
        rider = get_object_or_404(DeliveryMan, pk=request.data.get("deliveryManId"))
        if request.user.role == "branch_manager" and rider.branch_id != request.user.branch_id:
            raise PermissionDenied("That rider is not in your hub.")
        assign_rider(parcel, rider, changed_by=_actor_name(request.user))
        parcel.refresh_from_db()
        return Response(ParcelSerializer(parcel, context={"request": request}).data)


class ParcelDispatchView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.role not in ("admin", "super_admin", "branch_manager"):
            raise PermissionDenied("Only admin or branch managers can dispatch.")
        parcel = _scoped_parcel(request, pk)
        if not can_act_on(request.user, parcel):
            raise PermissionDenied("You cannot dispatch this parcel.")
        if parcel.status not in ("pending", "picked_up", "at_hub"):
            return Response(
                {"detail": f"Cannot dispatch a parcel that is {parcel.status}.", "errors": {}},
                status=400,
            )
        moved = dispatch_parcel(parcel, changed_by=_actor_name(request.user))
        if not moved:
            return Response({"detail": "Parcel has no next hop.", "errors": {}}, status=400)
        parcel.refresh_from_db()
        return Response(ParcelSerializer(parcel, context={"request": request}).data)


class ParcelSubmitToHubView(BaseAPIView):
    """A rider hands a picked-up parcel to the hub (picked_up → at_hub, rider released)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if user.role != "delivery_man":
            raise PermissionDenied("Only riders can submit parcels to the hub.")
        rider = getattr(user, "delivery_man", None)
        parcel = get_object_or_404(Parcel, pk=pk)
        if rider is None or parcel.delivery_man_id != rider.id:
            raise PermissionDenied("This parcel is not assigned to you.")
        if not submit_parcel_to_hub(parcel, changed_by=_actor_name(user)):
            return Response(
                {"detail": "Only picked-up parcels can be submitted.", "errors": {}},
                status=400,
            )
        parcel.refresh_from_db()
        return Response(ParcelSerializer(parcel, context={"request": request}).data)


class ParcelReturnView(BaseAPIView):
    """Start a return-to-origin (RTO) for a parcel held at a hub."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.role not in ("admin", "super_admin", "branch_manager"):
            raise PermissionDenied("Only admin or hub managers can start a return.")
        parcel = _scoped_parcel(request, pk)
        if not can_act_on(request.user, parcel):
            raise PermissionDenied("You cannot return this parcel.")
        if not initiate_return(parcel, reason=request.data.get("reason", ""), changed_by=_actor_name(request.user)):
            return Response(
                {"detail": "This parcel can't be returned in its current state.", "errors": {}},
                status=400,
            )
        parcel.refresh_from_db()
        return Response(ParcelSerializer(parcel, context={"request": request}).data)


class ParcelAcceptView(BaseAPIView):
    """Receiving hub confirms an inbound transfer (in_transit → at_hub)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if user.role not in ("admin", "super_admin", "branch_manager"):
            raise PermissionDenied("Only admin or branch managers can accept transfers.")
        parcel = _scoped_parcel(request, pk)
        if parcel.status != "in_transit":
            return Response(
                {"detail": "Only in-transit parcels can be accepted.", "errors": {}},
                status=400,
            )
        nxt = next_hop_branch_id(parcel.current_branch_id, parcel.destination_branch_id)
        if user.role == "branch_manager" and not is_admin(user) and nxt != user.branch_id:
            raise PermissionDenied("This parcel is not inbound to your hub.")
        accept_parcel(parcel, changed_by=_actor_name(user))
        parcel.refresh_from_db()
        return Response(ParcelSerializer(parcel, context={"request": request}).data)


class ParcelRejectView(BaseAPIView):
    """Receiving hub refuses an inbound transfer; custody stays with the sender."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if user.role not in ("admin", "super_admin", "branch_manager"):
            raise PermissionDenied("Only admin or branch managers can reject transfers.")
        parcel = _scoped_parcel(request, pk)
        if parcel.status != "in_transit":
            return Response(
                {"detail": "Only in-transit parcels can be rejected.", "errors": {}},
                status=400,
            )
        nxt = next_hop_branch_id(parcel.current_branch_id, parcel.destination_branch_id)
        if user.role == "branch_manager" and not is_admin(user) and nxt != user.branch_id:
            raise PermissionDenied("This parcel is not inbound to your hub.")
        reason = (request.data.get("reason") or "").strip()
        reject_parcel(parcel, reason=reason, changed_by=_actor_name(user))
        parcel.refresh_from_db()
        return Response(ParcelSerializer(parcel, context={"request": request}).data)


class RecipientStatsView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        phone = request.query_params.get("phone", "")
        exclude_id = request.query_params.get("excludeParcelId")
        exclude_id = int(exclude_id) if exclude_id and exclude_id.isdigit() else None
        stats = recipient_stats(phone, exclude_id)
        if stats is None:
            return Response({"detail": "Phone too short.", "errors": {}}, status=400)
        return Response(stats)


class TrackView(BaseAPIView):
    permission_classes = [AllowAny]

    def get(self, request, tracking_id):
        parcel = (
            Parcel.objects.select_related("merchant", "delivery_man")
            .filter(tracking_id__iexact=tracking_id)
            .first()
        )
        if parcel is None:
            raise NotFound("Parcel not found.")
        return Response(TrackingSerializer(parcel, context={"request": request}).data)


class ParcelImportView(BaseAPIView):
    """Bulk-book parcels from an uploaded CSV (merchant or admin-for-merchant)."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    REQUIRED = ["recipientName", "recipientPhone", "recipientAddress", "district"]

    def post(self, request):
        import csv
        import io

        user = request.user
        if user.role == "merchant":
            merchant = getattr(user, "merchant", None)
        elif is_admin(user):
            merchant = get_object_or_404(Merchant, pk=request.data.get("merchantId"))
        else:
            raise PermissionDenied("Only merchants or admins can import parcels.")
        if merchant is None:
            raise PermissionDenied("No merchant profile.")

        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "No file uploaded.", "errors": {}}, status=400)

        text = f.read().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        created, errors = [], []
        for i, row in enumerate(reader, start=2):  # row 1 = header
            row = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
            missing = [c for c in self.REQUIRED if not row.get(c)]
            if missing:
                errors.append({"row": i, "error": f"Missing: {', '.join(missing)}"})
                continue
            data = {
                "recipient_name": row["recipientName"],
                "recipient_phone": row["recipientPhone"],
                "alternative_phone": row.get("alternativePhone", ""),
                "recipient_email": row.get("recipientEmail", ""),
                "recipient_address": row["recipientAddress"],
                "district": row["district"],
                "upazila": row.get("upazila", ""),
                "delivery_type": (row.get("deliveryType") or "regular").lower(),
                "delivery_method": (row.get("deliveryMethod") or "home").lower(),
                "weight": float(row["weight"]) if row.get("weight") else 0.5,
                "product_description": row.get("productDescription", ""),
                "special_instructions": row.get("specialInstructions", ""),
                "invoice_number": row.get("invoiceNumber", ""),
                "cod_amount": int(float(row["codAmount"])) if row.get("codAmount") else 0,
            }
            try:
                parcel = book_parcel(merchant, data)
                created.append(parcel.tracking_id)
            except Exception as exc:  # noqa: BLE001 - report row-level failures
                errors.append({"row": i, "error": str(exc)})

        return Response({"created": len(created), "trackingIds": created, "errors": errors})


# ── Bags / line-haul manifests ──────────────────────────────────────────────


def _hub_of(request):
    """The acting hub for a branch manager (their own hub); admins act on any."""
    return None if is_admin(request.user) else request.user.branch_id


class BagListCreateView(BaseAPIView):
    """List bags for the viewer's hub (in/outbound) and build a new outbound bag."""

    permission_classes = [IsAuthenticated]

    def _guard(self, request):
        if request.user.role not in ("admin", "super_admin", "branch_manager"):
            raise PermissionDenied("Only admin or hub managers can manage bags.")

    def get(self, request):
        self._guard(request)
        qs = Bag.objects.all().prefetch_related("parcels")
        if not is_admin(request.user):
            b = request.user.branch_id
            qs = qs.filter(Q(from_branch_id=b) | Q(to_branch_id=b))
        status = request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        return Response(BagSerializer(qs[:200], many=True).data)

    def post(self, request):
        self._guard(request)
        to_id = request.data.get("toBranchId")
        parcel_ids = request.data.get("parcelIds") or []
        from_id = _hub_of(request) or request.data.get("fromBranchId")
        if not from_id or not to_id or not parcel_ids:
            return Response(
                {"detail": "fromBranchId, toBranchId and parcelIds are required.", "errors": {}},
                status=400,
            )
        from_branch = get_object_or_404(Branch, pk=from_id)
        to_branch = get_object_or_404(Branch, pk=to_id)
        # A hub manager may only build bags from their own hub.
        if not is_admin(request.user) and from_branch.id != request.user.branch_id:
            raise PermissionDenied("You can only build bags from your own hub.")
        parcels = list(Parcel.objects.filter(id__in=parcel_ids))
        bag = build_bag(from_branch, to_branch, parcels, changed_by=_actor_name(request.user))
        if bag.parcels.count() == 0:
            bag.delete()
            return Response(
                {"detail": "No eligible parcels for this bag (must be at your hub, routed to that hub).", "errors": {}},
                status=400,
            )
        return Response(BagSerializer(bag).data, status=201)


class BagDispatchView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        bag = get_object_or_404(Bag, pk=pk)
        if not is_admin(request.user) and bag.from_branch_id != request.user.branch_id:
            raise PermissionDenied("Only the sending hub can dispatch this bag.")
        if not dispatch_bag(bag, changed_by=_actor_name(request.user)):
            return Response({"detail": "Only open bags can be dispatched.", "errors": {}}, status=400)
        return Response(BagSerializer(bag).data)


class BagReceiveView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        bag = get_object_or_404(Bag, pk=pk)
        if not is_admin(request.user) and bag.to_branch_id != request.user.branch_id:
            raise PermissionDenied("Only the receiving hub can receive this bag.")
        if not receive_bag(bag, changed_by=_actor_name(request.user)):
            return Response({"detail": "Only dispatched bags can be received.", "errors": {}}, status=400)
        return Response(BagSerializer(bag).data)


class BaggableParcelsView(BaseAPIView):
    """Parcels resting at the viewer's hub that still need to move onward,
    grouped by their next hop — the candidates for building bags."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ("admin", "super_admin", "branch_manager"):
            raise PermissionDenied("Only admin or hub managers can view this.")
        hub_id = _hub_of(request) or request.query_params.get("hubId")
        if not hub_id:
            return Response({"detail": "hubId is required for admins.", "errors": {}}, status=400)
        groups: dict[int, dict] = {}
        for p in baggable_parcels_qs(hub_id).select_related("destination_branch"):
            nxt = parcel_next_hop(p)
            if nxt is None:
                continue  # at its final hub — for delivery / already returned
            g = groups.get(nxt)
            if g is None:
                hub = Branch.objects.filter(pk=nxt).first()
                g = {"toBranchId": nxt, "toBranchName": hub.name if hub else "", "parcels": []}
                groups[nxt] = g
            g["parcels"].append(
                {
                    "id": p.id,
                    "trackingId": p.tracking_id,
                    "recipientName": p.recipient_name,
                    "district": p.district,
                    "upazila": p.upazila,
                    "codAmount": p.cod_amount,
                    "destinationBranchId": p.destination_branch_id,
                }
            )
        return Response(list(groups.values()))


# ── Zone-rider Trips / Runsheet ─────────────────────────────────────────────


def _rider_of(request):
    rider = getattr(request.user, "delivery_man", None)
    if rider is None:
        raise PermissionDenied("Only delivery riders have trips.")
    return rider


class TripListCreateView(BaseAPIView):
    """Rider: list own trips / open a new one. Hub manager & admin: oversight."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Trip.objects.select_related("rider", "branch").prefetch_related("items__parcel")
        role = request.user.role
        if role == "delivery_man":
            qs = qs.filter(rider=_rider_of(request))
        elif role == "branch_manager":
            qs = qs.filter(branch_id=request.user.branch_id)
        elif not is_admin(request.user):
            raise PermissionDenied("Not allowed.")
        status = request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        return Response(TripSerializer(qs[:100], many=True).data)

    def post(self, request):
        rider = _rider_of(request)
        if Trip.objects.filter(rider=rider, status=Trip.Status.IN_PROGRESS).exists():
            return Response(
                {"detail": "You already have an active trip. Close it first.", "errors": {}},
                status=400,
            )
        trip = open_trip(rider, changed_by=_actor_name(request.user))
        return Response(TripSerializer(trip).data, status=201)


class TripActiveView(BaseAPIView):
    """The rider's current in-progress trip (or null) + pickups available to add."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        rider = _rider_of(request)
        trip = (
            Trip.objects.filter(rider=rider, status=Trip.Status.IN_PROGRESS)
            .prefetch_related("items__parcel")
            .first()
        )
        pickups = [
            {
                "parcelId": p.id,
                "trackingId": p.tracking_id,
                "recipientName": p.recipient_name,
                "codAmount": p.cod_amount,
                "merchantName": p.merchant.shop_name if p.merchant_id else "",
                "pickupAddress": ", ".join(
                    x for x in [p.merchant.address, p.merchant.district] if x
                ) if p.merchant_id else "",
            }
            for p in Parcel.objects.filter(
                delivery_man=rider, status=ParcelStatus.PENDING
            ).select_related("merchant")
        ]
        ready_count = sum(
            1
            for p in Parcel.objects.filter(
                delivery_man=rider, status=ParcelStatus.AT_HUB
            ).only("current_branch_id", "destination_branch_id")
            if p.current_branch_id == p.destination_branch_id
        )
        return Response(
            {
                "trip": TripSerializer(trip).data if trip else None,
                "availablePickups": pickups,
                "readyForDelivery": ready_count,
            }
        )


class _TripActionView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get_trip(self, request, pk):
        rider = _rider_of(request)
        trip = Trip.objects.filter(pk=pk, rider=rider, status=Trip.Status.IN_PROGRESS).first()
        if trip is None:
            raise NotFound("Active trip not found.")
        return trip, rider

    def get_parcel(self, request):
        parcel = Parcel.objects.filter(pk=request.data.get("parcelId")).first()
        if parcel is None:
            raise NotFound("Parcel not found.")
        return parcel


class TripDeliverView(_TripActionView):
    def post(self, request, pk):
        trip, _ = self.get_trip(request, pk)
        parcel = self.get_parcel(request)
        collected = request.data.get("collectedCod")
        ok, why = trip_deliver(
            trip, parcel,
            otp=request.data.get("otp", ""),
            collected_cod=int(collected) if collected not in (None, "") else None,
            changed_by=_actor_name(request.user),
        )
        if not ok:
            msgs = {
                "otp": "Incorrect delivery OTP.",
                "amount": "Invalid partial COD amount.",
                "not_on_trip": "That parcel is not on this trip.",
            }
            return Response({"detail": msgs.get(why, "Could not deliver."), "errors": {}}, status=400)
        return Response(TripSerializer(trip).data)


class TripFailView(_TripActionView):
    def post(self, request, pk):
        trip, _ = self.get_trip(request, pk)
        parcel = self.get_parcel(request)
        if not trip_fail(trip, parcel, reason=request.data.get("reason", ""), changed_by=_actor_name(request.user)):
            return Response({"detail": "That parcel is not on this trip.", "errors": {}}, status=400)
        return Response(TripSerializer(trip).data)


class TripPickupView(_TripActionView):
    def post(self, request, pk):
        trip, _ = self.get_trip(request, pk)
        parcel = self.get_parcel(request)
        if not trip_pickup(trip, parcel, changed_by=_actor_name(request.user)):
            return Response(
                {"detail": "Parcel not available for pickup (must be pending & assigned to you).", "errors": {}},
                status=400,
            )
        return Response(TripSerializer(trip).data)


class TripCloseView(_TripActionView):
    def post(self, request, pk):
        trip, _ = self.get_trip(request, pk)
        cash = request.data.get("cashHandedIn")
        if cash in (None, ""):
            return Response({"detail": "cashHandedIn is required.", "errors": {}}, status=400)
        summary = close_trip(trip, int(cash), changed_by=_actor_name(request.user))
        return Response({"trip": TripSerializer(trip).data, "summary": summary})
