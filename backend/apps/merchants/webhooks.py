"""Outbound webhook delivery (Steadfast-style).

When a parcel that belongs to a merchant changes status, we POST a JSON
`notification_type` payload to that merchant's configured Callback URL. If the
merchant set an Auth Token we send it as `Authorization: Bearer <token>` so they
can verify the call. Delivery is best-effort and runs on a background thread so
it never blocks (or fails) the operation that triggered it. Every attempt is
recorded in WebhookDelivery for the dashboard.
"""

import json
import threading
import urllib.error
import urllib.request

from django.db import connection
from django.utils import timezone

from . import steadfast


def _deliver(url, auth_token, merchant_id, notification_type, tracking_id, body):
    from .models import WebhookDelivery

    ok, status_code, error = False, None, ""
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "eCourier-Webhooks/1",
    }
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
    req = urllib.request.Request(url, data=body, method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            status_code = resp.status
            ok = 200 <= resp.status < 300
    except urllib.error.HTTPError as exc:
        status_code = exc.code
        error = f"HTTP {exc.code}"
    except Exception as exc:  # timeout, DNS, refused, bad URL — all best-effort
        error = str(exc)[:255]

    try:
        WebhookDelivery.objects.create(
            merchant_id=merchant_id,
            event=notification_type,
            tracking_id=tracking_id,
            ok=ok,
            status_code=status_code,
            error=error,
        )
    except Exception:
        pass
    finally:
        connection.close()  # thread-local connection — don't leak it


def _payload(parcel) -> tuple[str, dict]:
    """Build the (notification_type, payload) for a parcel's current status."""
    internal = parcel.status
    notification_type = steadfast.notification_type_for(internal)
    now = timezone.now().strftime("%Y-%m-%d %H:%M:%S")
    common = {
        "notification_type": notification_type,
        "consignment_id": parcel.id,
        "invoice": parcel.invoice_number or "",
        "tracking_message": steadfast.tracking_message(internal),
        "updated_at": now,
    }
    if notification_type == "delivery_status":
        common.update(
            {
                "cod_amount": float(parcel.cod_amount or 0),
                "status": steadfast.delivery_status(internal),
                "delivery_charge": float(parcel.delivery_charge or 0),
            }
        )
    return notification_type, common


def fire_parcel_webhook(parcel, event=None):
    """Queue a webhook for `parcel`'s merchant, if they have an active callback.

    Safe to call from any request path — swallows all errors and returns
    immediately (the actual HTTP send happens on a daemon thread). `event` is
    accepted for call-site compatibility but the notification type is derived
    from the parcel's current status.
    """
    try:
        merchant = getattr(parcel, "merchant", None)
        if merchant is None:
            return
        webhook = getattr(merchant, "webhook", None)
        if webhook is None or not webhook.is_active or not webhook.url:
            return

        notification_type, payload = _payload(parcel)
        body = json.dumps(payload, default=str).encode()
        threading.Thread(
            target=_deliver,
            args=(
                webhook.url,
                webhook.auth_token,
                merchant.id,
                notification_type,
                getattr(parcel, "tracking_id", ""),
                body,
            ),
            daemon=True,
        ).start()
    except Exception:
        return
