import json
from datetime import date
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.cod.models import HubRemittance
from apps.common.db import reset_sequences

SEED = (
    Path(settings.BASE_DIR).parent
    / "frontend" / "lib" / "mock-data" / "remittances.json"
)


class Command(BaseCommand):
    help = "Seed HubRemittance rows from the frontend mock data."

    def handle(self, *args, **options):
        if not SEED.exists():
            self.stdout.write("No remittances seed file; skipping.")
            return
        rows = json.loads(SEED.read_text(encoding="utf-8"))
        created = updated = 0
        for r in rows:
            _, was_created = HubRemittance.objects.update_or_create(
                pk=r["id"],
                defaults={
                    "branch_id": r["branchId"],
                    "amount": r["amount"],
                    "parcel_count": r.get("parcelCount", 0),
                    "reference": r.get("reference", ""),
                    "status": r.get("status", "pending"),
                    "note": r.get("note", ""),
                    "remitted_at": date.fromisoformat(r["remittedAt"]) if r.get("remittedAt") else date.today(),
                    "received_at": date.fromisoformat(r["receivedAt"]) if r.get("receivedAt") else None,
                },
            )
            created += was_created
            updated += not was_created
        reset_sequences(HubRemittance)
        self.stdout.write(self.style.SUCCESS(f"Remittances seeded: {created} created, {updated} updated."))
