"""Wipe accounts/hubs/parcels and seed a clean, deployment-ready structure:

  - 1 central hub + 2 delivery hubs (Mirpur, Mohakhali)
  - 1 branch manager login per hub (3)
  - 2 delivery men per hub (6), each with a login + rider profile
  - 1 super-admin + 1 demo merchant (with profile)

Run:  python manage.py reset_seed
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User, Role
from apps.branches.models import Branch, BranchType
from apps.merchants.models import Merchant, MerchantStatus
from apps.riders.models import DeliveryMan, DeliveryManStatus
from apps.parcels.models import Parcel

BRANCHES = [
    {"key": "central", "name": "Dhaka Central Hub", "code": "DHK-CEN",
     "type": BranchType.CENTRAL, "district": "Dhaka", "thana": "Tejgaon",
     "phone": "+8809610000000", "address": "Tejgaon I/A, Dhaka", "coverage": []},
    {"key": "mirpur", "name": "Mirpur Hub", "code": "MIR-01",
     "type": BranchType.HUB, "district": "Dhaka", "thana": "Mirpur",
     "phone": "+8809610000001", "address": "Mirpur 10, Dhaka",
     "coverage": ["Dhaka/Mirpur", "Dhaka/Pallabi", "Dhaka/Savar", "Dhaka/Dhamrai"]},
    {"key": "gulshan", "name": "Gulshan Hub", "code": "GUL-01",
     "type": BranchType.HUB, "district": "Dhaka", "thana": "Gulshan",
     "phone": "+8809610000002", "address": "Gulshan 1, Dhaka",
     "coverage": ["Dhaka/Gulshan", "Dhaka/Uttara", "Dhaka/Ramna"]},
    {"key": "dhanmondi", "name": "Dhanmondi Hub", "code": "DHN-01",
     "type": BranchType.HUB, "district": "Dhaka", "thana": "Dhanmondi",
     "phone": "+8809610000003", "address": "Dhanmondi 27, Dhaka",
     "coverage": ["Dhaka/Dhanmondi", "Dhaka/Mohammadpur", "Dhaka/Nawabganj"]},
    {"key": "motijheel", "name": "Motijheel Hub", "code": "MOT-01",
     "type": BranchType.HUB, "district": "Dhaka", "thana": "Motijheel",
     "phone": "+8809610000004", "address": "Motijheel C/A, Dhaka",
     "coverage": ["Dhaka/Motijheel", "Dhaka/Keraniganj", "Dhaka/Dohar"]},
]

MANAGERS = [
    {"branch": "central", "email": "central@cms.com", "password": "central123", "name": "Central Hub Manager"},
    {"branch": "mirpur", "email": "mirpur@cms.com", "password": "mirpur123", "name": "Mirpur Hub Manager"},
    {"branch": "gulshan", "email": "gulshan@cms.com", "password": "gulshan123", "name": "Gulshan Hub Manager"},
    {"branch": "dhanmondi", "email": "dhanmondi@cms.com", "password": "dhanmondi123", "name": "Dhanmondi Hub Manager"},
    {"branch": "motijheel", "email": "motijheel@cms.com", "password": "motijheel123", "name": "Motijheel Hub Manager"},
]

RIDER_PASSWORD = "rider1234"
RIDERS = [
    {"branch": "central", "email": "central.rider1@cms.com", "name": "Sohel Rana", "phone": "01710000001"},
    {"branch": "central", "email": "central.rider2@cms.com", "name": "Jamal Uddin", "phone": "01710000002"},
    {"branch": "mirpur", "email": "mirpur.rider1@cms.com", "name": "Rofiqul Islam", "phone": "01710000003"},
    {"branch": "mirpur", "email": "mirpur.rider2@cms.com", "name": "Kamal Hossain", "phone": "01710000004"},
    {"branch": "gulshan", "email": "gulshan.rider1@cms.com", "name": "Nasir Ahmed", "phone": "01710000005"},
    {"branch": "gulshan", "email": "gulshan.rider2@cms.com", "name": "Babul Mia", "phone": "01710000006"},
    {"branch": "dhanmondi", "email": "dhanmondi.rider1@cms.com", "name": "Arif Chowdhury", "phone": "01710000007"},
    {"branch": "dhanmondi", "email": "dhanmondi.rider2@cms.com", "name": "Shakil Ahmed", "phone": "01710000008"},
    {"branch": "motijheel", "email": "motijheel.rider1@cms.com", "name": "Habib Rahman", "phone": "01710000009"},
    {"branch": "motijheel", "email": "motijheel.rider2@cms.com", "name": "Faruk Hasan", "phone": "01710000010"},
]


class Command(BaseCommand):
    help = "Reset accounts/hubs/parcels and seed a clean central + 2 hubs structure."

    @transaction.atomic
    def handle(self, *args, **options):
        # 1) Wipe in dependency-safe order.
        Parcel.objects.all().delete()
        DeliveryMan.objects.all().delete()
        Merchant.objects.all().delete()
        User.objects.all().delete()
        Branch.objects.all().delete()
        self.stdout.write(self.style.WARNING("Cleared parcels, riders, merchants, users, branches."))

        # 2) Branches.
        branch = {}
        for b in BRANCHES:
            obj = Branch.objects.create(
                name=b["name"], code=b["code"], type=b["type"], district=b["district"],
                thana=b["thana"], phone=b["phone"], address=b["address"],
                coverage_thanas=b["coverage"], is_active=True,
            )
            branch[b["key"]] = obj
            self.stdout.write(f"  hub  {obj.code}  {obj.name}")

        # 3) Super admin.
        User.objects.create_user(
            email="admin@cms.com", password="admin123", name="System Admin",
            role=Role.SUPER_ADMIN, is_staff=True, is_superuser=True,
        )

        # 4) Demo merchant (+ profile), homed at Mirpur.
        muser = User.objects.create_user(
            email="merchant@cms.com", password="merchant123",
            name="Abdul Karim", role=Role.MERCHANT,
        )
        Merchant.objects.create(
            user=muser, name="Abdul Karim", shop_name="Karim Traders", phone="01720000000",
            district="Dhaka", status=MerchantStatus.ACTIVE, home_branch=branch["mirpur"],
        )

        # 5) Branch managers.
        for m in MANAGERS:
            User.objects.create_user(
                email=m["email"], password=m["password"], name=m["name"],
                role=Role.BRANCH_MANAGER, branch=branch[m["branch"]],
            )

        # 6) Delivery men (login + rider profile).
        for r in RIDERS:
            ruser = User.objects.create_user(
                email=r["email"], password=RIDER_PASSWORD, name=r["name"],
                role=Role.DELIVERY_MAN,
            )
            DeliveryMan.objects.create(
                user=ruser, name=r["name"], phone=r["phone"],
                status=DeliveryManStatus.ACTIVE, branch=branch[r["branch"]],
            )

        self.stdout.write(self.style.SUCCESS(
            "Seed complete — Dhaka: 1 central + 4 hubs, 5 managers, 10 riders, "
            f"1 admin, 1 merchant. Rider password: {RIDER_PASSWORD}"
        ))
