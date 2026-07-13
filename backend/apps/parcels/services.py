import secrets

from django.utils import timezone

from apps.branches.routing import (
    next_hop_branch_id,
    resolve_destination_hub,
    resolve_origin_hub,
)
from apps.common.otp import generate_otp
from apps.merchants.webhooks import fire_parcel_webhook
from apps.zones.charges import compute_charge, find_zone_by_district

from apps.common.otp import verify_otp

from .models import (
    Bag,
    BagStatus,
    Parcel,
    ParcelStatus,
    ParcelStatusEvent,
    ScanEventType,
    Trip,
    TripParcel,
)


def generate_tracking_id() -> str:
    year = timezone.now().year
    while True:
        n = secrets.randbelow(900000) + 100000
        tid = f"CMS-{year}-{n}"
        if not Parcel.objects.filter(tracking_id=tid).exists():
            return tid


# Default scan event type derived from the resulting parcel status, so existing
# callers get a sensible event_type without passing one explicitly.
_STATUS_EVENT_TYPE = {
    ParcelStatus.PENDING: ScanEventType.BOOKED,
    ParcelStatus.PICKED_UP: ScanEventType.PICKUP,
    ParcelStatus.IN_TRANSIT: ScanEventType.HUB_OUTBOUND,
    ParcelStatus.AT_HUB: ScanEventType.HUB_INBOUND,
    ParcelStatus.OUT_FOR_DELIVERY: ScanEventType.OUT_FOR_DELIVERY,
    ParcelStatus.DELIVERED: ScanEventType.DELIVERED,
    ParcelStatus.PARTIALLY_DELIVERED: ScanEventType.DELIVERED,
    ParcelStatus.RETURN_IN_TRANSIT: ScanEventType.RETURN,
    ParcelStatus.RETURNED: ScanEventType.RETURN,
    ParcelStatus.CANCELLED: ScanEventType.NOTE,
}


def add_status_event(
    parcel, status, remark="", changed_by="", proof_photo=None, proof_note="",
    event_type=None, hub=None, hub_id=None,
):
    if hub_id is None and hub is not None:
        hub_id = hub.id
    ParcelStatusEvent.objects.create(
        parcel=parcel,
        status=status,
        event_type=event_type or _STATUS_EVENT_TYPE.get(status, ScanEventType.NOTE),
        hub_id=hub_id,
        remark=remark or "",
        changed_by=changed_by or "",
        proof_photo=proof_photo,
        proof_note=proof_note or "",
    )


def target_branch_id(parcel):
    """The hub a parcel is trying to reach: its origin when returning (RTO),
    otherwise its destination. Single source of truth for routing direction."""
    return parcel.origin_branch_id if parcel.returning else parcel.destination_branch_id


def parcel_next_hop(parcel):
    """The next hub on the parcel's current route (forward or return)."""
    return next_hop_branch_id(parcel.current_branch_id, target_branch_id(parcel))


def book_parcel(merchant, data) -> Parcel:
    """Create a parcel: server-authoritative charges + hub routing + OTP."""
    district = data["district"]
    upazila = data.get("upazila", "")
    # Express-only for now (standard delivery to be re-enabled later).
    delivery_type = data.get("delivery_type", "express")
    weight = data.get("weight", 0.5)
    cod_amount = data.get("cod_amount", 0)

    zone = find_zone_by_district(district)
    charges = compute_charge(zone, delivery_type, weight, cod_amount) if zone else {
        "zoneName": "", "deliveryCharge": 0, "codCharge": 0, "totalCharge": 0,
    }

    origin = resolve_origin_hub(merchant.home_branch_id, merchant.district)
    destination = resolve_destination_hub(district, upazila)
    owner = merchant.home_branch or origin

    parcel = Parcel.objects.create(
        tracking_id=generate_tracking_id(),
        merchant=merchant,
        recipient_name=data["recipient_name"],
        recipient_phone=data["recipient_phone"],
        alternative_phone=data.get("alternative_phone", ""),
        recipient_email=data.get("recipient_email", ""),
        recipient_address=data["recipient_address"],
        district=district,
        upazila=upazila,
        zone=zone.name if zone else "",
        origin_branch=origin,
        destination_branch=destination,
        current_branch=origin,
        owner_branch=owner,
        delivery_type=delivery_type,
        delivery_method=data.get("delivery_method", "home"),
        weight=weight,
        product_description=data.get("product_description", ""),
        special_instructions=data.get("special_instructions", ""),
        invoice_number=data.get("invoice_number", ""),
        is_exchange=data.get("is_exchange", False),
        cod_amount=cod_amount,
        delivery_charge=charges["deliveryCharge"],
        cod_charge=charges["codCharge"],
        total_charge=charges["totalCharge"],
        status=ParcelStatus.PENDING,
        delivery_otp=generate_otp(),
    )
    add_status_event(parcel, ParcelStatus.PENDING, remark="Parcel booked", changed_by=merchant.name)
    fire_parcel_webhook(parcel, event="parcel.created")
    return parcel


def assign_rider(parcel, rider, changed_by="Admin"):
    was_assigned = parcel.delivery_man_id is not None and parcel.delivery_man_id != rider.id
    parcel.delivery_man = rider
    parcel.save(update_fields=["delivery_man"])
    add_status_event(
        parcel, parcel.status,
        remark=f"Assigned to delivery man: {rider.name}", changed_by=changed_by,
    )
    # Real-time + persisted rider notification. A still-pending parcel is a
    # pickup task — the rider needs the merchant's PICKUP address; once picked
    # up it's a delivery task and they need the recipient's address.
    from apps.notifications.services import push_rider_notification

    is_pickup = parcel.status == ParcelStatus.PENDING
    if is_pickup:
        merchant = parcel.merchant
        loc = merchant.address or merchant.district or "merchant address"
        title = "New pickup assigned"
        body = f"{parcel.tracking_id} · Pick up from {merchant.shop_name}, {loc}"
    else:
        area = f"{parcel.upazila}, " if parcel.upazila else ""
        title = "Parcel reassigned to you" if was_assigned else "New delivery assigned"
        body = f"{parcel.tracking_id} → {parcel.recipient_name}, {area}{parcel.district}"

    push_rider_notification(
        rider,
        type="reassignment" if was_assigned else "assignment",
        title=title,
        body=body,
        parcel=parcel,
    )


# ── Inter-hub custody handshake ─────────────────────────────────────────────
# A transfer is two steps for a clear chain of custody:
#   dispatch — the holding hub hands the parcel toward the next hop
#              (status → in_transit; it stays awaiting acceptance).
#   accept   — the next hub confirms receipt (status → at_hub; current advances).
#   reject   — the next hub refuses; custody stays with the sender (→ at_hub).
# Every step records the acting user for the timeline audit trail.


def dispatch_parcel(parcel, changed_by="Admin") -> bool:
    """Hand the parcel toward its next hop (in transit, awaiting acceptance).
    Routes toward the destination normally, or toward the origin when returning."""
    nxt = parcel_next_hop(parcel)
    if nxt is None:
        return False
    from apps.branches.models import Branch

    hub = Branch.objects.filter(pk=nxt).first()
    from_hub_id = parcel.current_branch_id
    returning = parcel.returning
    parcel.status = ParcelStatus.RETURN_IN_TRANSIT if returning else ParcelStatus.IN_TRANSIT
    # Releasing the parcel into the hub chain ends any rider's involvement (the
    # pickup rider is done; the destination hub assigns a fresh delivery rider).
    parcel.delivery_man = None
    parcel.save(update_fields=["status", "delivery_man"])
    verb = "Returned toward" if returning else "Dispatched to"
    add_status_event(
        parcel, parcel.status,
        remark=f"{verb} {hub.name}" if hub else verb, changed_by=changed_by,
        event_type=ScanEventType.HUB_OUTBOUND, hub_id=from_hub_id,
    )
    fire_parcel_webhook(parcel)
    return True


def accept_parcel(parcel, changed_by="Admin") -> bool:
    """Receiving hub confirms receipt: current hub advances, parcel rests at_hub.
    When a returning parcel reaches its origin, the return completes (→ returned)."""
    if parcel.status not in (ParcelStatus.IN_TRANSIT, ParcelStatus.RETURN_IN_TRANSIT):
        return False
    nxt = parcel_next_hop(parcel)
    if nxt is None:
        return False
    from apps.branches.models import Branch

    hub = Branch.objects.filter(pk=nxt).first()
    parcel.current_branch = hub
    if parcel.returning and nxt == parcel.origin_branch_id:
        # Back at the origin hub — the return is complete.
        parcel.status = ParcelStatus.RETURNED
        parcel.save(update_fields=["current_branch", "status"])
        add_status_event(
            parcel, ParcelStatus.RETURNED,
            remark=f"Returned to sender at {hub.name}" if hub else "Returned to sender",
            changed_by=changed_by, event_type=ScanEventType.RETURN, hub_id=nxt,
        )
    else:
        parcel.status = ParcelStatus.AT_HUB
        parcel.save(update_fields=["current_branch", "status"])
        add_status_event(
            parcel, ParcelStatus.AT_HUB,
            remark=f"Received at {hub.name}" if hub else "Received at hub",
            changed_by=changed_by, event_type=ScanEventType.HUB_INBOUND, hub_id=nxt,
        )
    fire_parcel_webhook(parcel)
    return True


def reject_parcel(parcel, reason="", changed_by="Admin") -> bool:
    """Receiving hub refuses the inbound transfer; custody stays with the sender."""
    if parcel.status != ParcelStatus.IN_TRANSIT:
        return False
    frm = parcel.current_branch
    parcel.status = ParcelStatus.AT_HUB
    parcel.save(update_fields=["status"])
    detail = f": {reason}" if reason else ""
    add_status_event(
        parcel, ParcelStatus.AT_HUB,
        remark=f"Transfer rejected{detail} — held at {frm.name if frm else 'sending hub'}",
        changed_by=changed_by,
    )
    fire_parcel_webhook(parcel)
    return True


def initiate_return(parcel, reason="", changed_by="Admin") -> bool:
    """Start an RTO (return to origin): flip the parcel's routing back toward its
    origin hub. It then flows destination → central → origin via the same bag /
    custody machinery (reversed) and completes as 'returned' at the origin."""
    if parcel.status in (
        ParcelStatus.DELIVERED, ParcelStatus.RETURNED, ParcelStatus.CANCELLED,
    ):
        return False
    parcel.returning = True
    if parcel.status == ParcelStatus.OUT_FOR_DELIVERY:
        parcel.status = ParcelStatus.AT_HUB  # pulled back from the rider
    parcel.delivery_man = None
    parcel.save(update_fields=["returning", "status", "delivery_man"])
    detail = f": {reason}" if reason else ""
    add_status_event(
        parcel, parcel.status, remark=f"Return initiated{detail}",
        changed_by=changed_by, event_type=ScanEventType.RETURN,
        hub_id=parcel.current_branch_id,
    )
    # Same-hub (origin == destination): it's already home — complete immediately.
    if parcel_next_hop(parcel) is None:
        parcel.status = ParcelStatus.RETURNED
        parcel.save(update_fields=["status"])
        add_status_event(
            parcel, ParcelStatus.RETURNED, remark="Returned to sender",
            changed_by=changed_by, event_type=ScanEventType.RETURN,
            hub_id=parcel.current_branch_id,
        )
    fire_parcel_webhook(parcel)
    return True


def submit_parcel_to_hub(parcel, changed_by="Rider") -> bool:
    """A pickup rider hands the collected parcel to the hub it's currently at.

    The parcel comes to rest at that hub (→ at_hub) and the rider is released;
    the hub then dispatches it onward into the custody chain. Only a picked-up
    parcel can be submitted.
    """
    if parcel.status != ParcelStatus.PICKED_UP:
        return False
    hub = parcel.current_branch
    parcel.status = ParcelStatus.AT_HUB
    parcel.delivery_man = None
    parcel.save(update_fields=["status", "delivery_man"])
    add_status_event(
        parcel, ParcelStatus.AT_HUB,
        remark=f"Submitted to {hub.name}" if hub else "Submitted to hub",
        changed_by=changed_by,
    )
    fire_parcel_webhook(parcel)
    return True


# ── Bags / line-haul manifests ──────────────────────────────────────────────
# A hub groups its onward parcels into a bag (one per next hop), dispatches the
# bag, and the receiving hub breaks it (accepts each parcel). Central re-bags by
# destination. Bagging drives the same custody functions above, in bulk.


def generate_bag_id() -> str:
    year = timezone.now().year
    while True:
        n = secrets.randbelow(900000) + 100000
        bid = f"BAG-{year}-{n}"
        if not Bag.objects.filter(bag_id=bid).exists():
            return bid


def baggable_parcels_qs(hub_id):
    """Parcels resting at `hub` that still need to move onward (not yet in an
    open/dispatched bag) — the candidates for a new outbound bag."""
    in_active_bag = Bag.objects.filter(
        status__in=[BagStatus.OPEN, BagStatus.DISPATCHED]
    ).values_list("parcels__id", flat=True)
    return (
        Parcel.objects.filter(
            current_branch_id=hub_id,
            status__in=[ParcelStatus.AT_HUB, ParcelStatus.PICKED_UP],
        )
        .exclude(id__in=in_active_bag)
    )


def build_bag(from_branch, to_branch, parcels, changed_by="") -> Bag:
    """Create an OPEN bag from_branch→to_branch containing the given parcels.
    Only parcels currently at `from_branch` whose next hop is `to_branch` are
    added (others are skipped defensively)."""
    bag = Bag.objects.create(
        bag_id=generate_bag_id(),
        from_branch=from_branch,
        to_branch=to_branch,
        created_by=changed_by,
    )
    valid = [
        p
        for p in parcels
        if p.current_branch_id == from_branch.id
        and parcel_next_hop(p) == to_branch.id
    ]
    if valid:
        bag.parcels.add(*valid)
    return bag


def dispatch_bag(bag, changed_by="Hub") -> bool:
    """Load + send a bag: dispatch every parcel in it (→ in_transit)."""
    if bag.status != BagStatus.OPEN:
        return False
    for parcel in bag.parcels.all():
        dispatch_parcel(parcel, changed_by=changed_by)
    bag.status = BagStatus.DISPATCHED
    bag.dispatched_at = timezone.now()
    bag.save(update_fields=["status", "dispatched_at"])
    return True


def receive_bag(bag, changed_by="Hub") -> bool:
    """Receive + break a bag at its destination: accept every parcel in it
    (→ at_hub at this hub). Parcels are then ready to re-bag or deliver."""
    if bag.status != BagStatus.DISPATCHED:
        return False
    for parcel in bag.parcels.all():
        accept_parcel(parcel, changed_by=changed_by)
    bag.status = BagStatus.RECEIVED
    bag.received_at = timezone.now()
    bag.save(update_fields=["status", "received_at"])
    return True


# ── Zone-rider Trips / Runsheet ─────────────────────────────────────────────
# One rider, one outing: leave the hub with deliverables, deliver + collect COD,
# pick up new parcels in-zone, return and reconcile cash. Reuses the custody +
# delivery machinery above; the Trip records both directions and the COD math.


def generate_trip_id() -> str:
    year = timezone.now().year
    while True:
        n = secrets.randbelow(900000) + 100000
        tid = f"TRIP-{year}-{n}"
        if not Trip.objects.filter(trip_id=tid).exists():
            return tid


def open_trip(rider, changed_by="") -> Trip:
    """Start a trip: bundle the rider's ready-for-delivery parcels (at their
    destination hub) and send them out for delivery."""
    trip = Trip.objects.create(
        trip_id=generate_trip_id(), rider=rider, branch=rider.branch
    )
    expected = 0
    deliverables = Parcel.objects.filter(
        delivery_man=rider, status=ParcelStatus.AT_HUB
    )
    for p in deliverables:
        if p.current_branch_id != p.destination_branch_id:
            continue  # only parcels resting at their delivery hub
        p.status = ParcelStatus.OUT_FOR_DELIVERY
        p.save(update_fields=["status"])
        add_status_event(
            p, ParcelStatus.OUT_FOR_DELIVERY,
            remark=f"Out for delivery (trip {trip.trip_id})", changed_by=changed_by,
        )
        TripParcel.objects.create(
            trip=trip, parcel=p,
            direction=TripParcel.Direction.DELIVERY, cod_amount=p.cod_amount or 0,
        )
        fire_parcel_webhook(p)
        expected += p.cod_amount or 0
    trip.expected_cod = expected
    trip.save(update_fields=["expected_cod"])
    return trip


def trip_deliver(trip, parcel, otp="", collected_cod=None, changed_by="") -> tuple[bool, str]:
    """Deliver a parcel on the trip. Full delivery collects the full COD;
    pass collected_cod for a partial delivery. OTP is verified."""
    tp = TripParcel.objects.filter(trip=trip, parcel=parcel).first()
    if tp is None:
        return False, "not_on_trip"
    if not verify_otp(parcel.delivery_otp, otp):
        return False, "otp"
    if collected_cod is not None:
        if collected_cod <= 0 or collected_cod > (parcel.cod_amount or 0):
            return False, "amount"
        parcel.status = ParcelStatus.PARTIALLY_DELIVERED
        parcel.collected_cod = collected_cod
        tp.outcome = TripParcel.Outcome.PARTIAL
        tp.collected_cod = collected_cod
    else:
        parcel.status = ParcelStatus.DELIVERED
        parcel.collected_cod = parcel.cod_amount
        tp.outcome = TripParcel.Outcome.DELIVERED
        tp.collected_cod = parcel.cod_amount or 0
    parcel.save(update_fields=["status", "collected_cod"])
    tp.save(update_fields=["outcome", "collected_cod"])
    add_status_event(parcel, parcel.status, remark="Delivered on trip", changed_by=changed_by)
    fire_parcel_webhook(parcel)
    return True, "ok"


def trip_fail(trip, parcel, reason="", changed_by="") -> bool:
    """Failed delivery: held back at the destination hub for reattempt."""
    tp = TripParcel.objects.filter(trip=trip, parcel=parcel).first()
    if tp is None:
        return False
    parcel.status = ParcelStatus.AT_HUB
    parcel.reattempt_count = (parcel.reattempt_count or 0) + 1
    parcel.save(update_fields=["status", "reattempt_count"])
    tp.outcome = TripParcel.Outcome.FAILED
    tp.failure_reason = (reason or "")[:150]
    tp.save(update_fields=["outcome", "failure_reason"])
    detail = f": {reason}" if reason else ""
    add_status_event(parcel, ParcelStatus.AT_HUB, remark=f"Delivery failed{detail}", changed_by=changed_by)
    fire_parcel_webhook(parcel)
    return True


def trip_pickup(trip, parcel, changed_by="") -> bool:
    """Collect a pending pickup (assigned to this rider) during the trip."""
    if parcel.status != ParcelStatus.PENDING or parcel.delivery_man_id != trip.rider_id:
        return False
    parcel.status = ParcelStatus.PICKED_UP
    parcel.save(update_fields=["status"])
    TripParcel.objects.get_or_create(
        trip=trip, parcel=parcel,
        defaults=dict(
            direction=TripParcel.Direction.PICKUP,
            outcome=TripParcel.Outcome.PICKED_UP,
            cod_amount=parcel.cod_amount or 0,
        ),
    )
    add_status_event(parcel, ParcelStatus.PICKED_UP, remark=f"Picked up (trip {trip.trip_id})", changed_by=changed_by)
    fire_parcel_webhook(parcel)
    return True


def close_trip(trip, cash_handed_in, changed_by="") -> dict:
    """Close the trip: hand pickups to the hub, reconcile COD (allow-short)."""
    for tp in trip.items.filter(direction=TripParcel.Direction.PICKUP):
        p = tp.parcel
        p.refresh_from_db()
        if p.status == ParcelStatus.PICKED_UP:
            submit_parcel_to_hub(p, changed_by=changed_by)
    due = sum(
        tp.collected_cod
        for tp in trip.items.filter(
            outcome__in=[TripParcel.Outcome.DELIVERED, TripParcel.Outcome.PARTIAL]
        )
    )
    trip.due_cod = due
    trip.collected_cod = cash_handed_in
    trip.cod_reconciled = cash_handed_in == due
    trip.status = Trip.Status.CLOSED
    trip.closed_at = timezone.now()
    trip.save(update_fields=["due_cod", "collected_cod", "cod_reconciled", "status", "closed_at"])
    return {
        "expected": trip.expected_cod,
        "due": due,
        "collected": cash_handed_in,
        "short": due - cash_handed_in,  # >0 = rider owes
        "reconciled": trip.cod_reconciled,
    }


def collected_cod_of(parcel) -> int:
    if parcel.status == ParcelStatus.DELIVERED:
        return parcel.collected_cod if parcel.collected_cod is not None else parcel.cod_amount
    if parcel.status == ParcelStatus.PARTIALLY_DELIVERED:
        return parcel.collected_cod or 0
    return 0
