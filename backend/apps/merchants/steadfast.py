"""Mapping between e-courier's internal parcel statuses and the Steadfast-style
status vocabulary exposed to merchants through the public API and webhooks."""

# Full status vocabulary (create response + status checks). Mirrors the labels
# merchants already know from Steadfast.
_FULL = {
    "pending": "in_review",          # order placed, awaiting pickup/processing
    "picked_up": "pending",          # accepted & moving, not delivered yet
    "in_transit": "pending",
    "at_hub": "pending",
    "out_for_delivery": "pending",
    "delivered": "delivered",
    "partially_delivered": "partial_delivered",
    "return_in_transit": "cancelled",
    "returned": "cancelled",
    "cancelled": "cancelled",
}

# Simplified delivery-status vocabulary used in `delivery_status` webhooks.
_DELIVERY = {
    "delivered": "delivered",
    "partially_delivered": "partial_delivered",
    "cancelled": "cancelled",
    "returned": "cancelled",
    "return_in_transit": "cancelled",
}

# Which internal statuses are "delivery status" changes (vs. tracking movements)
# for the purpose of choosing a webhook notification_type.
_DELIVERY_STATES = {
    "delivered",
    "partially_delivered",
    "cancelled",
    "returned",
}

# Human-readable tracking message per internal status (tracking_update webhook).
_TRACKING_MESSAGE = {
    "pending": "Your order has been placed and is awaiting pickup.",
    "picked_up": "Your parcel has been picked up.",
    "in_transit": "Your parcel is in transit.",
    "at_hub": "Your parcel has arrived at the hub.",
    "out_for_delivery": "Your parcel is out for delivery.",
    "return_in_transit": "Your parcel is being returned to the sender.",
    "delivered": "Your parcel has been delivered successfully.",
    "partially_delivered": "Your parcel was partially delivered.",
    "cancelled": "Your parcel has been cancelled.",
    "returned": "Your parcel has been returned to the sender.",
}


def full_status(internal: str) -> str:
    return _FULL.get(internal, "unknown")


def delivery_status(internal: str) -> str:
    return _DELIVERY.get(internal, "pending")


def notification_type_for(internal: str) -> str:
    return "delivery_status" if internal in _DELIVERY_STATES else "tracking_update"


def tracking_message(internal: str) -> str:
    return _TRACKING_MESSAGE.get(internal, "Your parcel status has been updated.")
