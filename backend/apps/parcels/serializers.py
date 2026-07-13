from rest_framework import serializers

from .models import Bag, Parcel, ParcelStatus, ParcelStatusEvent, Trip
from .services import book_parcel


class ParcelStatusEventSerializer(serializers.ModelSerializer):
    changedBy = serializers.CharField(source="changed_by")
    eventType = serializers.CharField(source="event_type")
    hubName = serializers.SerializerMethodField()
    proof = serializers.SerializerMethodField()

    class Meta:
        model = ParcelStatusEvent
        fields = ["status", "eventType", "hubName", "remark", "changedBy", "timestamp", "proof"]

    def get_hubName(self, obj):
        return obj.hub.name if obj.hub_id else None

    def get_proof(self, obj):
        if not (obj.proof_photo or obj.proof_note):
            return None
        request = self.context.get("request")
        photo = obj.proof_photo.url if obj.proof_photo else None
        if photo and request:
            photo = request.build_absolute_uri(photo)
        return {"photo": photo, "note": obj.proof_note or None}


class ParcelSerializer(serializers.ModelSerializer):
    trackingId = serializers.CharField(source="tracking_id", read_only=True)
    merchantId = serializers.IntegerField(source="merchant_id", read_only=True)
    merchantName = serializers.SerializerMethodField()
    merchantPhone = serializers.SerializerMethodField()
    pickupAddress = serializers.SerializerMethodField()
    recipientName = serializers.CharField(source="recipient_name", read_only=True)
    recipientPhone = serializers.CharField(source="recipient_phone", read_only=True)
    alternativePhone = serializers.CharField(source="alternative_phone", read_only=True)
    recipientEmail = serializers.CharField(source="recipient_email", read_only=True)
    recipientAddress = serializers.CharField(source="recipient_address", read_only=True)
    originBranchId = serializers.IntegerField(source="origin_branch_id", read_only=True)
    destinationBranchId = serializers.IntegerField(source="destination_branch_id", read_only=True)
    currentBranchId = serializers.IntegerField(source="current_branch_id", read_only=True)
    ownerBranchId = serializers.IntegerField(source="owner_branch_id", read_only=True)
    deliveryType = serializers.CharField(source="delivery_type", read_only=True)
    deliveryMethod = serializers.CharField(source="delivery_method", read_only=True)
    productDescription = serializers.CharField(source="product_description", read_only=True)
    specialInstructions = serializers.CharField(source="special_instructions", read_only=True)
    invoiceNumber = serializers.CharField(source="invoice_number", read_only=True)
    isExchange = serializers.BooleanField(source="is_exchange", read_only=True)
    codAmount = serializers.IntegerField(source="cod_amount", read_only=True)
    collectedCod = serializers.IntegerField(source="collected_cod", read_only=True)
    deliveryCharge = serializers.IntegerField(source="delivery_charge", read_only=True)
    codCharge = serializers.IntegerField(source="cod_charge", read_only=True)
    totalCharge = serializers.IntegerField(source="total_charge", read_only=True)
    deliveryManId = serializers.IntegerField(source="delivery_man_id", read_only=True)
    deliveryManName = serializers.SerializerMethodField()
    deliveryManPhone = serializers.SerializerMethodField()
    deliveryOtp = serializers.CharField(source="delivery_otp", read_only=True)
    returning = serializers.BooleanField(read_only=True)
    reattemptCount = serializers.IntegerField(source="reattempt_count", read_only=True)
    createdAt = serializers.DateField(source="created_at", read_only=True)
    history = ParcelStatusEventSerializer(many=True, read_only=True)

    class Meta:
        model = Parcel
        fields = [
            "id", "trackingId", "merchantId", "merchantName",
            "merchantPhone", "pickupAddress",
            "recipientName", "recipientPhone", "alternativePhone", "recipientEmail",
            "recipientAddress", "district", "upazila", "zone",
            "originBranchId", "destinationBranchId", "currentBranchId", "ownerBranchId",
            "deliveryType", "deliveryMethod", "weight",
            "productDescription", "specialInstructions", "invoiceNumber", "isExchange",
            "codAmount", "collectedCod", "deliveryCharge", "codCharge", "totalCharge",
            "status", "deliveryManId", "deliveryManName", "deliveryManPhone",
            "deliveryOtp", "returning", "reattemptCount", "createdAt", "history",
        ]

    def get_merchantName(self, obj):
        return obj.merchant.shop_name if obj.merchant_id else ""

    def get_merchantPhone(self, obj):
        return obj.merchant.phone if obj.merchant_id else ""

    def get_pickupAddress(self, obj):
        # Where the rider collects from — the merchant's address (+ district).
        if not obj.merchant_id:
            return ""
        m = obj.merchant
        return ", ".join(x for x in [m.address, m.district] if x)

    def get_deliveryManName(self, obj):
        return obj.delivery_man.name if obj.delivery_man_id else None

    def get_deliveryManPhone(self, obj):
        return obj.delivery_man.phone if obj.delivery_man_id else None


class TrackingSerializer(serializers.ModelSerializer):
    """Public, customer-facing view — no OTP, charges, or internal remarks."""

    trackingId = serializers.CharField(source="tracking_id", read_only=True)
    recipientName = serializers.CharField(source="recipient_name", read_only=True)
    merchantName = serializers.SerializerMethodField()
    productDescription = serializers.CharField(source="product_description", read_only=True)
    deliveryType = serializers.CharField(source="delivery_type", read_only=True)
    originBranchId = serializers.IntegerField(source="origin_branch_id", read_only=True)
    destinationBranchId = serializers.IntegerField(source="destination_branch_id", read_only=True)
    currentBranchId = serializers.IntegerField(source="current_branch_id", read_only=True)
    deliveryMan = serializers.SerializerMethodField()
    history = serializers.SerializerMethodField()

    class Meta:
        model = Parcel
        fields = [
            "trackingId", "status", "recipientName", "district", "upazila",
            "merchantName", "productDescription", "weight", "deliveryType",
            "originBranchId", "destinationBranchId", "currentBranchId",
            "deliveryMan", "history",
        ]

    def get_merchantName(self, obj):
        return obj.merchant.shop_name if obj.merchant_id else ""

    def get_deliveryMan(self, obj):
        if not obj.delivery_man_id:
            return None
        # Hide the rider's phone once the parcel reaches a terminal state.
        terminal = obj.status in ("delivered", "returned", "cancelled")
        return {
            "name": obj.delivery_man.name,
            "phone": None if terminal else obj.delivery_man.phone,
        }

    def get_history(self, obj):
        return [
            {
                "status": e.status,
                "eventType": e.event_type or None,
                "hubName": e.hub.name if e.hub_id else None,
                "remark": e.remark or None,
                "timestamp": e.timestamp,
            }
            for e in obj.history.all()
        ]


class ParcelCreateSerializer(serializers.ModelSerializer):
    recipientName = serializers.CharField(source="recipient_name")
    recipientPhone = serializers.CharField(source="recipient_phone")
    alternativePhone = serializers.CharField(source="alternative_phone", required=False, allow_blank=True)
    recipientEmail = serializers.CharField(source="recipient_email", required=False, allow_blank=True)
    recipientAddress = serializers.CharField(source="recipient_address")
    upazila = serializers.CharField(required=False, allow_blank=True)
    # Express-only for now; "regular" kept as a valid choice for future re-enable.
    deliveryType = serializers.ChoiceField(source="delivery_type", choices=["regular", "express"], default="express")
    deliveryMethod = serializers.ChoiceField(source="delivery_method", choices=["home", "point"], default="home")
    productDescription = serializers.CharField(source="product_description", required=False, allow_blank=True)
    specialInstructions = serializers.CharField(source="special_instructions", required=False, allow_blank=True)
    invoiceNumber = serializers.CharField(source="invoice_number", required=False, allow_blank=True)
    isExchange = serializers.BooleanField(source="is_exchange", required=False, default=False)
    codAmount = serializers.IntegerField(source="cod_amount", required=False, default=0, min_value=0)

    class Meta:
        model = Parcel
        fields = [
            "recipientName", "recipientPhone", "alternativePhone", "recipientEmail",
            "recipientAddress", "district", "upazila", "deliveryType", "deliveryMethod",
            "weight", "productDescription", "specialInstructions", "invoiceNumber",
            "isExchange", "codAmount",
        ]

    def create(self, validated):
        return book_parcel(self.context["merchant"], validated)


class BagSerializer(serializers.ModelSerializer):
    bagId = serializers.CharField(source="bag_id", read_only=True)
    fromBranchId = serializers.IntegerField(source="from_branch_id", read_only=True)
    toBranchId = serializers.IntegerField(source="to_branch_id", read_only=True)
    fromBranchName = serializers.SerializerMethodField()
    toBranchName = serializers.SerializerMethodField()
    parcelCount = serializers.SerializerMethodField()
    parcels = serializers.SerializerMethodField()
    createdBy = serializers.CharField(source="created_by", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    dispatchedAt = serializers.DateTimeField(source="dispatched_at", read_only=True)
    receivedAt = serializers.DateTimeField(source="received_at", read_only=True)

    class Meta:
        model = Bag
        fields = [
            "id", "bagId", "status", "fromBranchId", "toBranchId",
            "fromBranchName", "toBranchName", "parcelCount", "parcels",
            "createdBy", "createdAt", "dispatchedAt", "receivedAt",
        ]

    def get_fromBranchName(self, obj):
        return obj.from_branch.name if obj.from_branch_id else None

    def get_toBranchName(self, obj):
        return obj.to_branch.name if obj.to_branch_id else None

    def get_parcelCount(self, obj):
        return obj.parcels.count()

    def get_parcels(self, obj):
        return [
            {
                "id": p.id,
                "trackingId": p.tracking_id,
                "recipientName": p.recipient_name,
                "district": p.district,
                "upazila": p.upazila,
                "codAmount": p.cod_amount,
            }
            for p in obj.parcels.all()
        ]


class TripSerializer(serializers.ModelSerializer):
    tripId = serializers.CharField(source="trip_id", read_only=True)
    riderId = serializers.IntegerField(source="rider_id", read_only=True)
    riderName = serializers.SerializerMethodField()
    branchId = serializers.IntegerField(source="branch_id", read_only=True)
    branchName = serializers.SerializerMethodField()
    expectedCod = serializers.IntegerField(source="expected_cod", read_only=True)
    dueCod = serializers.IntegerField(source="due_cod", read_only=True)
    collectedCod = serializers.IntegerField(source="collected_cod", read_only=True)
    codReconciled = serializers.BooleanField(source="cod_reconciled", read_only=True)
    startedAt = serializers.DateTimeField(source="started_at", read_only=True)
    closedAt = serializers.DateTimeField(source="closed_at", read_only=True)
    items = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = [
            "id", "tripId", "status", "riderId", "riderName", "branchId", "branchName",
            "expectedCod", "dueCod", "collectedCod", "codReconciled",
            "startedAt", "closedAt", "items",
        ]

    def get_riderName(self, obj):
        return obj.rider.name if obj.rider_id else None

    def get_branchName(self, obj):
        return obj.branch.name if obj.branch_id else None

    def get_items(self, obj):
        return [
            {
                "parcelId": tp.parcel_id,
                "trackingId": tp.parcel.tracking_id,
                "recipientName": tp.parcel.recipient_name,
                "recipientPhone": tp.parcel.recipient_phone,
                "recipientAddress": tp.parcel.recipient_address,
                "upazila": tp.parcel.upazila,
                "district": tp.parcel.district,
                "direction": tp.direction,
                "outcome": tp.outcome,
                "codAmount": tp.cod_amount,
                "collectedCod": tp.collected_cod,
                "failureReason": tp.failure_reason,
            }
            for tp in obj.items.select_related("parcel").all()
        ]


class StatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ParcelStatus.values)
    remark = serializers.CharField(required=False, allow_blank=True, default="")
    otp = serializers.CharField(required=False, allow_blank=True, default="")
    collectedCod = serializers.IntegerField(required=False, min_value=0)
    proofNote = serializers.CharField(required=False, allow_blank=True, default="")
    proofPhoto = serializers.ImageField(required=False)
