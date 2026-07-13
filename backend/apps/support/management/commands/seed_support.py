import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils.dateparse import parse_datetime
from django.utils import timezone

from apps.common.db import reset_sequences
from apps.support.models import SupportMessage, SupportTicket

SEED = (
    Path(settings.BASE_DIR).parent
    / "frontend" / "lib" / "mock-data" / "support-tickets.json"
)


class Command(BaseCommand):
    help = "Seed support tickets + messages from the frontend mock data."

    def handle(self, *args, **options):
        if not SEED.exists():
            self.stdout.write("No support seed; skipping.")
            return
        rows = json.loads(SEED.read_text(encoding="utf-8"))
        from apps.merchants.models import Merchant
        merchant_ids = set(Merchant.objects.values_list("id", flat=True))
        rows = [r for r in rows if r["merchantId"] in merchant_ids]
        for r in rows:
            ticket, _ = SupportTicket.objects.update_or_create(
                pk=r["id"],
                defaults={
                    "ref": r["ref"], "merchant_id": r["merchantId"], "subject": r["subject"],
                    "category": r.get("category", "other"), "priority": r.get("priority", "medium"),
                    "status": r.get("status", "open"), "tracking_id": r.get("trackingId", ""),
                    "unread_for_admin": r.get("unreadForAdmin", False),
                    "unread_for_merchant": r.get("unreadForMerchant", False),
                    "created_at": parse_datetime(r["createdAt"]) or timezone.now(),
                    "updated_at": parse_datetime(r["updatedAt"]) or timezone.now(),
                },
            )
            ticket.messages.all().delete()
            for m in r.get("messages", []):
                SupportMessage.objects.create(
                    ticket=ticket, sender=m["sender"], sender_name=m.get("senderName", ""),
                    body=m.get("body", ""),
                    created_at=parse_datetime(m["createdAt"]) or timezone.now(),
                )
        reset_sequences(SupportTicket, SupportMessage)
        self.stdout.write(self.style.SUCCESS(f"Support seeded: {len(rows)} tickets."))
