from django.db import models
from django.utils import timezone


class ParcelStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PICKED_UP = "picked_up", "Picked Up"
    IN_TRANSIT = "in_transit", "In Transit"
    AT_HUB = "at_hub", "At Hub"
    OUT_FOR_DELIVERY = "out_for_delivery", "Out for Delivery"
    DELIVERED = "delivered", "Delivered"
    PARTIALLY_DELIVERED = "partially_delivered", "Partially Delivered"
    RETURN_IN_TRANSIT = "return_in_transit", "Return in Transit"
    RETURNED = "returned", "Returned"
    CANCELLED = "cancelled", "Cancelled"


class DeliveryType(models.TextChoices):
    REGULAR = "regular", "Regular"
    EXPRESS = "express", "Express"


class DeliveryMethod(models.TextChoices):
    HOME = "home", "Home"
    POINT = "point", "Point"


class Parcel(models.Model):
    tracking_id = models.CharField(max_length=30, unique=True)
    merchant = models.ForeignKey(
        "merchants.Merchant", on_delete=models.CASCADE, related_name="parcels"
    )

    recipient_name = models.CharField(max_length=150)
    recipient_phone = models.CharField(max_length=30)
    alternative_phone = models.CharField(max_length=30, blank=True)
    recipient_email = models.EmailField(blank=True)
    recipient_address = models.CharField(max_length=255)
    district = models.CharField(max_length=80)
    upazila = models.CharField(max_length=80, blank=True)
    zone = models.CharField(max_length=80, blank=True)

    # Hub routing
    origin_branch = models.ForeignKey(
        "branches.Branch", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    destination_branch = models.ForeignKey(
        "branches.Branch", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    current_branch = models.ForeignKey(
        "branches.Branch", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    owner_branch = models.ForeignKey(
        "branches.Branch", null=True, blank=True, on_delete=models.SET_NULL, related_name="owned_parcels"
    )

    # Express-only for now; REGULAR retained in choices for future re-enable.
    delivery_type = models.CharField(max_length=10, choices=DeliveryType.choices, default=DeliveryType.EXPRESS)
    delivery_method = models.CharField(max_length=10, choices=DeliveryMethod.choices, default=DeliveryMethod.HOME)
    weight = models.FloatField(default=0.5)
    product_description = models.CharField(max_length=255, blank=True)
    special_instructions = models.CharField(max_length=255, blank=True)
    invoice_number = models.CharField(max_length=60, blank=True)
    is_exchange = models.BooleanField(default=False)

    cod_amount = models.IntegerField(default=0)
    collected_cod = models.IntegerField(null=True, blank=True)
    delivery_charge = models.IntegerField(default=0)
    cod_charge = models.IntegerField(default=0)
    total_charge = models.IntegerField(default=0)

    status = models.CharField(max_length=20, choices=ParcelStatus.choices, default=ParcelStatus.PENDING)
    delivery_man = models.ForeignKey(
        "riders.DeliveryMan", null=True, blank=True, on_delete=models.SET_NULL, related_name="parcels"
    )
    delivery_otp = models.CharField(max_length=4, blank=True)
    reattempt_count = models.PositiveSmallIntegerField(default=0)
    returning = models.BooleanField(default=False)  # RTO: routing reversed to origin
    created_at = models.DateField(default=timezone.localdate)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.tracking_id


class BagStatus(models.TextChoices):
    OPEN = "open", "Open"              # being filled at the origin hub
    DISPATCHED = "dispatched", "Dispatched"  # loaded and in transit (line-haul)
    RECEIVED = "received", "Received"  # arrived + broken (parcels scanned in)


class Bag(models.Model):
    """A line-haul manifest: parcels grouped for one hub→hub transfer.

    Parcels are bagged at a hub for their next hop, dispatched together, then the
    receiving hub 'breaks' the bag (scans each parcel in). Central re-bags by
    destination. Individual custody still runs per parcel underneath.
    """

    bag_id = models.CharField(max_length=30, unique=True, db_index=True)
    from_branch = models.ForeignKey(
        "branches.Branch", null=True, on_delete=models.SET_NULL, related_name="outbound_bags"
    )
    to_branch = models.ForeignKey(
        "branches.Branch", null=True, on_delete=models.SET_NULL, related_name="inbound_bags"
    )
    status = models.CharField(max_length=12, choices=BagStatus.choices, default=BagStatus.OPEN)
    parcels = models.ManyToManyField(Parcel, related_name="bags", blank=True)
    created_by = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.bag_id


class Trip(models.Model):
    """A zone rider's round-trip runsheet: leave the hub with deliverables,
    deliver + collect COD, pick up new parcels in-zone, return and reconcile.
    """

    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In Progress"
        CLOSED = "closed", "Closed"

    trip_id = models.CharField(max_length=30, unique=True, db_index=True)
    rider = models.ForeignKey(
        "riders.DeliveryMan", on_delete=models.CASCADE, related_name="trips"
    )
    branch = models.ForeignKey(
        "branches.Branch", null=True, on_delete=models.SET_NULL, related_name="trips"
    )
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.IN_PROGRESS)

    # COD reconciliation (integers = BDT, matching Parcel.cod_amount)
    expected_cod = models.IntegerField(default=0)   # total COD dispatched on the trip
    due_cod = models.IntegerField(default=0)         # collectable = COD of delivered parcels
    collected_cod = models.IntegerField(default=0)   # cash the rider actually handed in
    cod_reconciled = models.BooleanField(default=False)

    started_at = models.DateTimeField(default=timezone.now)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at", "-id"]

    def __str__(self):
        return self.trip_id


class TripParcel(models.Model):
    """A parcel on a trip, tagged by direction (delivery vs pickup) + outcome."""

    class Direction(models.TextChoices):
        DELIVERY = "delivery", "Delivery"
        PICKUP = "pickup", "Pickup"

    class Outcome(models.TextChoices):
        PENDING = "pending", "Pending"
        DELIVERED = "delivered", "Delivered"
        PARTIAL = "partial", "Partially Delivered"
        FAILED = "failed", "Failed"
        PICKED_UP = "picked_up", "Picked Up"

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="items")
    parcel = models.ForeignKey(Parcel, on_delete=models.CASCADE, related_name="trip_items")
    direction = models.CharField(max_length=10, choices=Direction.choices)
    outcome = models.CharField(max_length=12, choices=Outcome.choices, default=Outcome.PENDING)
    cod_amount = models.IntegerField(default=0)      # snapshot at assignment
    collected_cod = models.IntegerField(default=0)   # collected on delivery
    failure_reason = models.CharField(max_length=150, blank=True)

    class Meta:
        unique_together = ("trip", "parcel")
        ordering = ["id"]


class ScanEventType(models.TextChoices):
    BOOKED = "booked", "Booked"
    PICKUP = "pickup", "Pickup"
    HUB_INBOUND = "hub_inbound", "Hub Inbound"
    HUB_OUTBOUND = "hub_outbound", "Hub Outbound"
    SORT = "sort", "Sorted"
    OUT_FOR_DELIVERY = "out_for_delivery", "Out for Delivery"
    DELIVERED = "delivered", "Delivered"
    FAILED = "failed", "Delivery Failed"
    RETURN = "return", "Return"
    NOTE = "note", "Note"


class ParcelStatusEvent(models.Model):
    """The scan trail: one row per physical/logical movement of a parcel,
    tagged with the event type and the hub it happened at (source of truth for
    tracking)."""

    parcel = models.ForeignKey(Parcel, on_delete=models.CASCADE, related_name="history")
    status = models.CharField(max_length=20, choices=ParcelStatus.choices)
    event_type = models.CharField(max_length=20, choices=ScanEventType.choices, blank=True)
    hub = models.ForeignKey(
        "branches.Branch", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    remark = models.CharField(max_length=255, blank=True)
    changed_by = models.CharField(max_length=120, blank=True)
    proof_photo = models.ImageField(upload_to="proof/", null=True, blank=True)
    proof_note = models.CharField(max_length=255, blank=True)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["timestamp", "id"]

    def __str__(self):
        return f"{self.parcel_id}:{self.status}"
