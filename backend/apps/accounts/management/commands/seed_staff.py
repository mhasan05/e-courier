from django.core.management.base import BaseCommand

from apps.accounts.models import Role, User

# Demo staff that aren't merchants/riders (admin superuser is created separately).
STAFF = [
    {"email": "branch@cms.com", "name": "Chattogram Hub Manager",
     "role": Role.BRANCH_MANAGER, "branch_id": 2, "password": "branch123"},
    # Central sorting hub (Dhaka Central Hub, branch id 1): accepts inbound
    # transfers and dispatches them onward to the destination hub.
    {"email": "central@cms.com", "name": "Central Hub Manager",
     "role": Role.BRANCH_MANAGER, "branch_id": 1, "password": "central123"},
]


class Command(BaseCommand):
    help = "Seed demo staff accounts (branch managers)."

    def handle(self, *args, **options):
        for s in STAFF:
            user, _ = User.objects.get_or_create(
                email=s["email"], defaults={"name": s["name"], "role": s["role"]}
            )
            user.name = s["name"]
            user.role = s["role"]
            user.branch_id = s.get("branch_id")
            user.set_password(s["password"])
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Staff ready: {s['email']} ({s['role']})"))
