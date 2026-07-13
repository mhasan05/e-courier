"""Public merchant API (`/api/merchant/v1/`) — authenticated by API key.

Merchants integrate these endpoints on their own sites to auto-create and track
parcels. Reuses the same booking pipeline (`book_parcel`) as the dashboard, so
charges/hub-routing/OTP are identical to a parcel booked in the app.
"""
import json
import re

from django.core.cache import cache
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.branches.models import Branch
from apps.common.views import BaseAPIView
from apps.parcels.models import Parcel
from apps.parcels.serializers import ParcelCreateSerializer
from apps.parcels.services import add_status_event, book_parcel
from apps.zones.charges import compute_charge, find_zone_by_district

from .authentication import ApiKeyAuthentication
from . import steadfast
from .throttles import MerchantApiDayThrottle, MerchantApiThrottle

IDEM_TTL = 60 * 60 * 24  # 24h

# Launch coverage is Dhaka-only; recipient area is parsed from the address (or
# an optional recipient_area field) and used only to pick the destination hub.
DEFAULT_DISTRICT = "Dhaka"


class MerchantParcelSerializer(serializers.ModelSerializer):
    """Stable, curated parcel representation for the public API."""

    trackingId = serializers.CharField(source="tracking_id", read_only=True)
    recipientName = serializers.CharField(source="recipient_name", read_only=True)
    recipientPhone = serializers.CharField(source="recipient_phone", read_only=True)
    recipientAddress = serializers.CharField(source="recipient_address", read_only=True)
    productDescription = serializers.CharField(source="product_description", read_only=True)
    deliveryType = serializers.CharField(source="delivery_type", read_only=True)
    codAmount = serializers.IntegerField(source="cod_amount", read_only=True)
    deliveryCharge = serializers.IntegerField(source="delivery_charge", read_only=True)
    codCharge = serializers.IntegerField(source="cod_charge", read_only=True)
    totalCharge = serializers.IntegerField(source="total_charge", read_only=True)
    createdAt = serializers.DateField(source="created_at", read_only=True)
    history = serializers.SerializerMethodField()

    class Meta:
        model = Parcel
        fields = [
            "trackingId", "status", "recipientName", "recipientPhone",
            "recipientAddress", "district", "upazila", "weight",
            "productDescription", "deliveryType", "codAmount", "deliveryCharge",
            "codCharge", "totalCharge", "createdAt", "history",
        ]

    def get_history(self, obj):
        return [
            {"status": e.status, "remark": e.remark or None, "timestamp": e.timestamp}
            for e in obj.history.all()
        ]


class _MerchantApiView(BaseAPIView):
    authentication_classes = [ApiKeyAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [MerchantApiThrottle, MerchantApiDayThrottle]


class ParcelsView(_MerchantApiView):
    def get(self, request):
        qs = Parcel.objects.filter(merchant=request.merchant).order_by("-created_at")
        status = request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        page = self.paginate(qs, request)
        data = MerchantParcelSerializer(page.object_list, many=True).data
        return self.paginated_response(page, data)

    def post(self, request):
        idem = request.headers.get("Idempotency-Key")
        cache_key = f"idem:{request.merchant.id}:{idem}" if idem else None
        if cache_key:
            prior = cache.get(cache_key)
            if prior:
                parcel = Parcel.objects.filter(tracking_id=prior).first()
                if parcel:
                    return Response(MerchantParcelSerializer(parcel).data, status=200)

        ser = ParcelCreateSerializer(
            data=request.data, context={"merchant": request.merchant}
        )
        ser.is_valid(raise_exception=True)
        parcel = ser.save()
        if cache_key:
            cache.set(cache_key, parcel.tracking_id, IDEM_TTL)
        return Response(MerchantParcelSerializer(parcel).data, status=201)


class ParcelDetailView(_MerchantApiView):
    def get(self, request, tracking_id):
        parcel = Parcel.objects.filter(
            merchant=request.merchant, tracking_id__iexact=tracking_id
        ).first()
        if parcel is None:
            raise NotFound("Parcel not found.")
        return Response(MerchantParcelSerializer(parcel).data)


class ParcelCancelView(_MerchantApiView):
    def post(self, request, tracking_id):
        parcel = Parcel.objects.filter(
            merchant=request.merchant, tracking_id__iexact=tracking_id
        ).first()
        if parcel is None:
            raise NotFound("Parcel not found.")
        if parcel.status != "pending":
            return Response(
                {"detail": "Only pending parcels can be cancelled.", "errors": {}},
                status=400,
            )
        parcel.status = "cancelled"
        parcel.save(update_fields=["status"])
        add_status_event(
            parcel, "cancelled", remark="Cancelled via API",
            changed_by=f"{request.merchant.shop_name} (API)",
        )
        from .webhooks import fire_parcel_webhook

        fire_parcel_webhook(parcel)
        parcel.refresh_from_db()
        return Response(MerchantParcelSerializer(parcel).data)


class QuoteView(_MerchantApiView):
    def post(self, request):
        district = (request.data.get("district") or "").strip()
        if not district:
            return Response({"detail": "district is required.", "errors": {}}, status=400)
        weight = float(request.data.get("weight") or 0.5)
        cod_amount = int(request.data.get("codAmount") or 0)
        delivery_type = request.data.get("deliveryType") or "express"
        zone = find_zone_by_district(district)
        if zone is None:
            return Response({"detail": "No zone serves that district.", "errors": {}}, status=400)
        return Response(compute_charge(zone, delivery_type, weight, cod_amount))


class CoverageView(_MerchantApiView):
    def get(self, request):
        areas: dict[str, set] = {}
        for b in Branch.objects.filter(is_active=True):
            for key in b.coverage_thanas or []:
                district, _, thana = key.partition("/")
                if thana:
                    areas.setdefault(district, set()).add(thana)
        return Response(
            {
                "districts": [
                    {"district": d, "thanas": sorted(t)}
                    for d, t in sorted(areas.items())
                ]
            }
        )


# ── Steadfast-style order creation ──────────────────────────────────────────

_PHONE_RE = re.compile(r"^\d{11}$")
_INVOICE_RE = re.compile(r"^[A-Za-z0-9_-]+$")


def _resolve_area(address: str, explicit: str = "") -> tuple[str, str]:
    """Return (district, thana). District is Dhaka for the current launch; the
    thana is taken from an explicit field if given, else best-effort matched
    against active-hub coverage inside the address text."""
    if explicit:
        return DEFAULT_DISTRICT, explicit.strip()
    haystack = (address or "").lower()
    for b in Branch.objects.filter(is_active=True):
        for key in b.coverage_thanas or []:
            _, _, thana = key.partition("/")
            if thana and thana.lower() in haystack:
                return DEFAULT_DISTRICT, thana
    return DEFAULT_DISTRICT, ""


class SteadfastOrderSerializer(serializers.Serializer):
    """Validates one Steadfast-style order payload."""

    invoice = serializers.CharField(max_length=100)
    recipient_name = serializers.CharField(max_length=100)
    recipient_phone = serializers.CharField(max_length=20)
    alternative_phone = serializers.CharField(required=False, allow_blank=True, default="")
    recipient_email = serializers.EmailField(required=False, allow_blank=True, default="")
    recipient_address = serializers.CharField(max_length=250)
    recipient_area = serializers.CharField(required=False, allow_blank=True, default="")
    cod_amount = serializers.FloatField(min_value=0)
    note = serializers.CharField(required=False, allow_blank=True, default="")
    item_description = serializers.CharField(required=False, allow_blank=True, default="")
    total_lot = serializers.IntegerField(required=False, min_value=0, default=1)
    delivery_type = serializers.IntegerField(required=False, min_value=0, max_value=1, default=0)

    def validate_invoice(self, v):
        if not _INVOICE_RE.match(v):
            raise serializers.ValidationError(
                "invoice may contain only letters, numbers, hyphens and underscores."
            )
        return v

    def validate_recipient_phone(self, v):
        if not _PHONE_RE.match(v):
            raise serializers.ValidationError("recipient_phone must be an 11-digit number.")
        return v

    def validate_alternative_phone(self, v):
        if v and not _PHONE_RE.match(v):
            raise serializers.ValidationError("alternative_phone must be an 11-digit number.")
        return v


def _book_steadfast_order(merchant, v) -> Parcel:
    """Create a parcel from validated Steadfast-style input. Enforces per-merchant
    invoice uniqueness (which also makes retries idempotent-ish)."""
    district, thana = _resolve_area(v["recipient_address"], v.get("recipient_area", ""))
    data = {
        "recipient_name": v["recipient_name"],
        "recipient_phone": v["recipient_phone"],
        "alternative_phone": v.get("alternative_phone", ""),
        "recipient_email": v.get("recipient_email", ""),
        "recipient_address": v["recipient_address"],
        "district": district,
        "upazila": thana,
        "delivery_type": "express",  # express-only for now
        "delivery_method": "point" if v.get("delivery_type") == 1 else "home",
        "weight": 0.5,
        "cod_amount": int(round(v["cod_amount"])),
        "product_description": v.get("item_description", ""),
        "special_instructions": v.get("note", ""),
        "invoice_number": v["invoice"],
        "is_exchange": False,
    }
    return book_parcel(merchant, data)


def _consignment(parcel: Parcel) -> dict:
    """Steadfast-shaped consignment object for the create/bulk responses."""
    return {
        "consignment_id": parcel.id,
        "invoice": parcel.invoice_number,
        "tracking_code": parcel.tracking_id,
        "recipient_name": parcel.recipient_name,
        "recipient_phone": parcel.recipient_phone,
        "recipient_address": parcel.recipient_address,
        "cod_amount": parcel.cod_amount,
        "status": steadfast.full_status(parcel.status),
        "note": parcel.special_instructions or None,
        "created_at": parcel.created_at.isoformat(),
        "updated_at": timezone.now().isoformat(),
    }


class CreateOrderView(_MerchantApiView):
    """POST /create_order — create a single consignment."""

    def post(self, request):
        ser = SteadfastOrderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        v = ser.validated_data
        if Parcel.objects.filter(
            merchant=request.merchant, invoice_number=v["invoice"]
        ).exists():
            return Response(
                {"status": 400, "message": f"invoice '{v['invoice']}' already exists."},
                status=400,
            )
        parcel = _book_steadfast_order(request.merchant, v)
        return Response(
            {
                "status": 200,
                "message": "Consignment has been created successfully.",
                "consignment": _consignment(parcel),
            },
            status=200,
        )


class BulkCreateOrderView(_MerchantApiView):
    """POST /create_order/bulk-order — create up to 500 consignments.

    Accepts `data` as a JSON-encoded string (Steadfast style) or a native array.
    Returns a per-row result list; a bad row is marked "error" and skipped
    rather than failing the whole batch.
    """

    MAX_ITEMS = 500

    def post(self, request):
        raw = request.data.get("data")
        if raw is None:
            return Response({"status": 400, "message": "data is required."}, status=400)
        if isinstance(raw, str):
            try:
                items = json.loads(raw)
            except json.JSONDecodeError:
                return Response(
                    {"status": 400, "message": "data must be a JSON-encoded array."},
                    status=400,
                )
        else:
            items = raw
        if not isinstance(items, list):
            return Response({"status": 400, "message": "data must be an array."}, status=400)
        if len(items) > self.MAX_ITEMS:
            return Response(
                {"status": 400, "message": f"Maximum {self.MAX_ITEMS} items allowed."},
                status=400,
            )

        results = []
        for item in items:
            base = {
                "invoice": (item or {}).get("invoice"),
                "recipient_name": (item or {}).get("recipient_name"),
                "recipient_address": (item or {}).get("recipient_address"),
                "recipient_phone": (item or {}).get("recipient_phone"),
                "cod_amount": (item or {}).get("cod_amount"),
                "note": (item or {}).get("note"),
                "consignment_id": None,
                "tracking_code": None,
                "status": "error",
            }
            ser = SteadfastOrderSerializer(data=item or {})
            if not ser.is_valid():
                base["message"] = "; ".join(
                    f"{k}: {v[0]}" for k, v in ser.errors.items()
                )
                results.append(base)
                continue
            v = ser.validated_data
            if Parcel.objects.filter(
                merchant=request.merchant, invoice_number=v["invoice"]
            ).exists():
                base["message"] = f"invoice '{v['invoice']}' already exists."
                results.append(base)
                continue
            parcel = _book_steadfast_order(request.merchant, v)
            base.update(
                {
                    "consignment_id": parcel.id,
                    "tracking_code": parcel.tracking_id,
                    "status": "success",
                }
            )
            results.append(base)

        return Response({"status": 200, "data": results}, status=200)
