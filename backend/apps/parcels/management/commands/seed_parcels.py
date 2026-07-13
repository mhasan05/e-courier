import json
from datetime import date
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils.dateparse import parse_datetime
from django.utils import timezone

from apps.common.db import reset_sequences
from apps.common.otp import generate_otp
from apps.parcels.models import Parcel, ParcelStatusEvent

SEED = (
    Path(settings.BASE_DIR).parent
    / "frontend" / "lib" / "mock-data" / "parcels.json"
)


class Command(BaseCommand):
    help = "Seed Parcel rows (+ status history) from the frontend mock data."

    def handle(self, *args, **options):
        if not SEED.exists():
            self.stderr.write(f"Seed file not found: {SEED}")
            return
        rows = json.loads(SEED.read_text(encoding="utf-8"))
        from apps.merchants.models import Merchant
        from apps.riders.models import DeliveryMan

        merchant_ids = set(Merchant.objects.values_list("id", flat=True))
        rider_ids = set(DeliveryMan.objects.values_list("id", flat=True))
        # Only seed parcels whose merchant still exists.
        rows = [r for r in rows if r["merchantId"] in merchant_ids]
        created = updated = 0
        for r in rows:
            dm_id = r.get("deliveryManId")
            if dm_id not in rider_ids:
                dm_id = None
            parcel, was_created = Parcel.objects.update_or_create(
                pk=r["id"],
                defaults={
                    "tracking_id": r["trackingId"],
                    "merchant_id": r["merchantId"],
                    "recipient_name": r["recipientName"],
                    "recipient_phone": r["recipientPhone"],
                    "alternative_phone": r.get("alternativePhone", ""),
                    "recipient_email": r.get("recipientEmail", ""),
                    "recipient_address": r["recipientAddress"],
                    "district": r["district"],
                    "upazila": r.get("upazila", ""),
                    "zone": r.get("zone", ""),
                    "origin_branch_id": r.get("originBranchId"),
                    "destination_branch_id": r.get("destinationBranchId"),
                    "current_branch_id": r.get("currentBranchId"),
                    "owner_branch_id": r.get("ownerBranchId"),
                    "delivery_type": r.get("deliveryType", "regular"),
                    "delivery_method": r.get("deliveryMethod", "home"),
                    "weight": r.get("weight", 0.5),
                    "product_description": r.get("productDescription", ""),
                    "special_instructions": r.get("specialInstructions", ""),
                    "invoice_number": r.get("invoiceNumber", ""),
                    "is_exchange": r.get("isExchange", False),
                    "cod_amount": r.get("codAmount", 0),
                    "collected_cod": r.get("collectedCod"),
                    "delivery_charge": r.get("deliveryCharge", 0),
                    "cod_charge": r.get("codCharge", 0),
                    "total_charge": r.get("totalCharge", 0),
                    "status": r.get("status", "pending"),
                    "delivery_man_id": dm_id,
                    "delivery_otp": generate_otp(),
                    "created_at": date.fromisoformat(r["createdAt"]) if r.get("createdAt") else date.today(),
                },
            )
            # Rebuild history from seed events.
            parcel.history.all().delete()
            for e in r.get("history", []):
                ts = parse_datetime(e["timestamp"]) if e.get("timestamp") else None
                ParcelStatusEvent.objects.create(
                    parcel=parcel,
                    status=e["status"],
                    remark=e.get("remark", ""),
                    changed_by=e.get("changedBy", ""),
                    timestamp=ts or timezone.now(),
                )
            created += was_created
            updated += not was_created
        reset_sequences(Parcel)
        self.stdout.write(self.style.SUCCESS(f"Parcels seeded: {created} created, {updated} updated."))
