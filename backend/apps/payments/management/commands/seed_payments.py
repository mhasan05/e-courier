import json
from datetime import date
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.common.db import reset_sequences
from apps.payments.models import (
    AvailablePaymentMethod,
    MerchantPayoutMethod,
    WithdrawalRequest,
)

MOCK = Path(settings.BASE_DIR).parent / "frontend" / "lib" / "mock-data"


def _load(name):
    f = MOCK / name
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else []


class Command(BaseCommand):
    help = "Seed payment methods, merchant payout methods, and withdrawals."

    def handle(self, *args, **options):
        for r in _load("payment-methods.json"):
            AvailablePaymentMethod.objects.update_or_create(
                pk=r["id"],
                defaults={
                    "name": r["name"], "type": r["type"], "is_active": r.get("isActive", True),
                    "min_amount": r.get("minAmount", 0), "charge_percent": r.get("chargePercent", 0),
                    "instructions": r.get("instructions", ""),
                },
            )
        from apps.merchants.models import Merchant
        merchant_ids = set(Merchant.objects.values_list("id", flat=True))
        for r in _load("merchant-payout-methods.json"):
            if r["merchantId"] not in merchant_ids:
                continue
            MerchantPayoutMethod.objects.update_or_create(
                pk=r["id"],
                defaults={
                    "merchant_id": r["merchantId"], "method_id": r.get("methodId"),
                    "method_name": r.get("methodName", ""), "type": r["type"],
                    "account_name": r.get("accountName", ""), "account_number": r.get("accountNumber", ""),
                    "bank_name": r.get("bankName", ""), "branch": r.get("branch", ""),
                    "is_default": r.get("isDefault", False),
                },
            )
        valid_payout_ids = set(MerchantPayoutMethod.objects.values_list("id", flat=True))
        for r in _load("withdrawals.json"):
            if r["merchantId"] not in merchant_ids:
                continue
            pm_id = r.get("payoutMethodId")
            if pm_id not in valid_payout_ids:
                pm_id = None
            WithdrawalRequest.objects.update_or_create(
                pk=r["id"],
                defaults={
                    "merchant_id": r["merchantId"], "amount": r["amount"], "charge": r.get("charge", 0),
                    "payout_method_id": pm_id, "payout_label": r.get("payoutLabel", ""),
                    "status": r.get("status", "pending"),
                    "requested_at": date.fromisoformat(r["requestedAt"]) if r.get("requestedAt") else date.today(),
                    "processed_at": date.fromisoformat(r["processedAt"]) if r.get("processedAt") else None,
                    "reference": r.get("reference", ""), "note": r.get("note", ""),
                },
            )
        reset_sequences(AvailablePaymentMethod, MerchantPayoutMethod, WithdrawalRequest)
        self.stdout.write(self.style.SUCCESS("Payments seeded."))
