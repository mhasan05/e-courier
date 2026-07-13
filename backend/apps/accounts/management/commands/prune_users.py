from django.core.management.base import BaseCommand

from apps.accounts.models import User

# One login per role. Everything owned by the deleted users cascades away
# (merchants → their parcels/payments/tickets; riders → handovers/notifications).
KEEP = {
    "admin@cms.com",
    "branch@cms.com",
    "merchant@cms.com",
    "jamal.rider@cms.com",
}


class Command(BaseCommand):
    help = "Keep a single user per role; delete the rest and their data."

    def handle(self, *args, **options):
        extra = User.objects.exclude(email__in=KEEP)
        emails = list(extra.values_list("email", flat=True))
        count = extra.count()
        extra.delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {count} users."))
        for e in emails:
            self.stdout.write(f"  - {e}")
