import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.branches.models import Branch
from apps.common.db import reset_sequences

# Frontend seed (repo_root/frontend/lib/mock-data/branches.json).
SEED = (
    Path(settings.BASE_DIR).parent
    / "frontend" / "lib" / "mock-data" / "branches.json"
)


class Command(BaseCommand):
    help = "Seed Branch rows from the frontend mock data (idempotent, preserves ids)."

    def handle(self, *args, **options):
        if not SEED.exists():
            self.stderr.write(f"Seed file not found: {SEED}")
            return
        rows = json.loads(SEED.read_text(encoding="utf-8"))
        created = updated = 0
        for r in rows:
            _, was_created = Branch.objects.update_or_create(
                pk=r["id"],
                defaults={
                    "name": r["name"],
                    "code": r["code"],
                    "type": r.get("type", "hub"),
                    "phone": r.get("phone", ""),
                    "address": r.get("address", ""),
                    "district": r["district"],
                    "thana": r.get("thana", ""),
                    "coverage_thanas": r.get("coverageThanas", []),
                    "is_active": r.get("isActive", True),
                },
            )
            created += was_created
            updated += not was_created
        reset_sequences(Branch)
        self.stdout.write(self.style.SUCCESS(f"Branches seeded: {created} created, {updated} updated."))
