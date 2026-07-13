import re

from .models import Parcel


def _normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    return digits[-11:] if len(digits) > 11 else digits


def _tier(rate):
    if rate is None:
        return "new"
    if rate >= 0.8:
        return "good"
    if rate >= 0.5:
        return "ok"
    return "risky"


def recipient_stats(phone: str, exclude_id=None):
    """Delivery-success history for a recipient phone (fraud signal).
    Mirrors lib/recipient-stats.ts. Returns None if the phone is too short."""
    norm = _normalize_phone(phone)
    if len(norm) < 6:
        return None

    delivered = returned = cancelled = in_progress = 0
    total = 0
    for p in Parcel.objects.all().only("id", "recipient_phone", "status"):
        if exclude_id and p.id == exclude_id:
            continue
        if _normalize_phone(p.recipient_phone) != norm:
            continue
        total += 1
        if p.status in ("delivered", "partially_delivered"):
            delivered += 1
        elif p.status in ("returned", "return_in_transit"):
            returned += 1
        elif p.status == "cancelled":
            cancelled += 1
        else:
            in_progress += 1

    completed = delivered + returned
    success_rate = (delivered / completed) if completed else None
    return {
        "total": total,
        "delivered": delivered,
        "returned": returned,
        "cancelled": cancelled,
        "inProgress": in_progress,
        "completed": completed,
        "successRate": success_rate,
        "tier": _tier(success_rate),
    }
