import json
from datetime import date
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.accounts.models import Role, User
from apps.common.db import reset_sequences
from apps.merchants.models import Merchant

SEED = (
    Path(settings.BASE_DIR).parent
    / "frontend" / "lib" / "mock-data" / "merchants.json"
)
DEFAULT_PASSWORD = "merchant123"


class Command(BaseCommand):
    help = "Seed Merchant rows (+ linked login users) from the frontend mock data."

    def handle(self, *args, **options):
        if not SEED.exists():
            self.stderr.write(f"Seed file not found: {SEED}")
            return
        rows = json.loads(SEED.read_text(encoding="utf-8"))
        # Keep a single demo merchant (one login per role).
        rows = [r for r in rows if r["email"].lower() == "merchant@cms.com"]
        created = updated = 0
        for r in rows:
            email = r["email"].lower()
            user, _ = User.objects.get_or_create(
                email=email, defaults={"name": r["name"], "role": Role.MERCHANT}
            )
            user.name = r["name"]
            user.role = Role.MERCHANT
            user.set_password(DEFAULT_PASSWORD)
            user.save()

            _, was_created = Merchant.objects.update_or_create(
                pk=r["id"],
                defaults={
                    "user": user,
                    "name": r["name"],
                    "shop_name": r["shopName"],
                    "phone": r.get("phone", ""),
                    "address": r.get("address", ""),
                    "district": r.get("district", ""),
                    "business_type": r.get("businessType", ""),
                    "status": r.get("status", "pending"),
                    "join_date": date.fromisoformat(r["joinDate"]) if r.get("joinDate") else date.today(),
                    "cod_collected": r.get("codCollected", 0),
                    "cod_disbursed": r.get("codDisbursed", 0),
                    "cod_pending": r.get("codPending", 0),
                    "home_branch_id": r.get("homeBranchId"),
                },
            )
            created += was_created
            updated += not was_created
        reset_sequences(Merchant)
        self.stdout.write(self.style.SUCCESS(f"Merchants seeded: {created} created, {updated} updated."))
