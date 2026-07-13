import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.common.db import reset_sequences
from apps.zones.models import Zone

SEED = (
    Path(settings.BASE_DIR).parent
    / "frontend" / "lib" / "mock-data" / "zones.json"
)


class Command(BaseCommand):
    help = "Seed Zone rows from the frontend mock data (idempotent, preserves ids)."

    def handle(self, *args, **options):
        if not SEED.exists():
            self.stderr.write(f"Seed file not found: {SEED}")
            return
        rows = json.loads(SEED.read_text(encoding="utf-8"))
        created = updated = 0
        for r in rows:
            _, was_created = Zone.objects.update_or_create(
                pk=r["id"],
                defaults={
                    "name": r["name"],
                    "districts": r.get("districts", []),
                    "regular_charge": r["regularCharge"],
                    "express_charge": r["expressCharge"],
                    "cod_charge_percent": r["codChargePercent"],
                    "return_charge": r["returnCharge"],
                    "is_active": r.get("isActive", True),
                },
            )
            created += was_created
            updated += not was_created
        reset_sequences(Zone)
        self.stdout.write(self.style.SUCCESS(f"Zones seeded: {created} created, {updated} updated."))
