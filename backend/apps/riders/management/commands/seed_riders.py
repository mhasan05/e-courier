import json
from datetime import date
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.accounts.models import Role, User
from apps.common.db import reset_sequences
from apps.riders.models import DEFAULT_RIDER_PASSWORD, DeliveryMan

SEED = (
    Path(settings.BASE_DIR).parent
    / "frontend" / "lib" / "mock-data" / "deliverymen.json"
)


class Command(BaseCommand):
    help = "Seed DeliveryMan rows (+ linked login users) from the frontend mock data."

    def handle(self, *args, **options):
        if not SEED.exists():
            self.stderr.write(f"Seed file not found: {SEED}")
            return
        rows = json.loads(SEED.read_text(encoding="utf-8"))
        # Keep a single demo rider (one login per role).
        rows = [r for r in rows if r["email"].lower() == "jamal.rider@cms.com"]
        created = updated = 0
        for r in rows:
            email = r["email"].lower()
            user, _ = User.objects.get_or_create(
                email=email, defaults={"name": r["name"], "role": Role.DELIVERY_MAN}
            )
            user.name = r["name"]
            user.role = Role.DELIVERY_MAN
            user.set_password(DEFAULT_RIDER_PASSWORD)
            user.save()

            _, was_created = DeliveryMan.objects.update_or_create(
                pk=r["id"],
                defaults={
                    "user": user,
                    "name": r["name"],
                    "phone": r.get("phone", ""),
                    "nid": r.get("nid", ""),
                    "passport": r.get("passport", ""),
                    "status": r.get("status", "active"),
                    "branch_id": r.get("branchId"),
                    "created_at": date.fromisoformat(r["createdAt"]) if r.get("createdAt") else date.today(),
                },
            )
            created += was_created
            updated += not was_created
        reset_sequences(DeliveryMan)
        self.stdout.write(self.style.SUCCESS(f"Riders seeded: {created} created, {updated} updated."))
