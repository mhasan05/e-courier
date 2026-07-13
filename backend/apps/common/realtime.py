from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def broadcast(group: str, event: str, payload: dict):
    """Send a real-time event to a channel group (no-op if channels isn't set up).

    Consumers receive it via a handler method named after `event` (dots → underscores).
    """
    layer = get_channel_layer()
    if layer is None:
        return
    async_to_sync(layer.group_send)(group, {"type": event, "payload": payload})


def rider_group(rider_id) -> str:
    return f"notify_rider_{rider_id}"


def ticket_group(ticket_id) -> str:
    return f"ticket_{ticket_id}"
