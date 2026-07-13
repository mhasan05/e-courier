from apps.common.realtime import broadcast, rider_group

from .models import RiderNotification
from .serializers import RiderNotificationSerializer


def push_rider_notification(rider, *, type, title, body, parcel=None, tracking_id=""):
    """Persist a rider notification and push it over WebSocket in real time."""
    note = RiderNotification.objects.create(
        rider=rider, type=type, title=title, body=body,
        parcel=parcel, tracking_id=tracking_id or (parcel.tracking_id if parcel else ""),
    )
    broadcast(
        rider_group(rider.id),
        "notify.message",
        RiderNotificationSerializer(note).data,
    )
    return note
