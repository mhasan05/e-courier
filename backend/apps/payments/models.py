from django.db import models
from django.utils import timezone


class MethodType(models.TextChoices):
    BANK = "bank", "Bank"
    MOBILE = "mobile", "Mobile"


class WithdrawalStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    PAID = "paid", "Paid"
    REJECTED = "rejected", "Rejected"


class AvailablePaymentMethod(models.Model):
    name = models.CharField(max_length=80)
    type = models.CharField(max_length=10, choices=MethodType.choices, default=MethodType.MOBILE)
    is_active = models.BooleanField(default=True)
    min_amount = models.IntegerField(default=0)
    charge_percent = models.FloatField(default=0)
    instructions = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.name


class MerchantPayoutMethod(models.Model):
    merchant = models.ForeignKey("merchants.Merchant", on_delete=models.CASCADE, related_name="payout_methods")
    method = models.ForeignKey(AvailablePaymentMethod, null=True, on_delete=models.SET_NULL, related_name="+")
    method_name = models.CharField(max_length=80)
    type = models.CharField(max_length=10, choices=MethodType.choices)
    account_name = models.CharField(max_length=120)
    account_number = models.CharField(max_length=60)
    bank_name = models.CharField(max_length=120, blank=True)
    branch = models.CharField(max_length=120, blank=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        ordering = ["-is_default", "id"]


class WithdrawalRequest(models.Model):
    merchant = models.ForeignKey("merchants.Merchant", on_delete=models.CASCADE, related_name="withdrawals")
    amount = models.IntegerField(default=0)
    charge = models.IntegerField(default=0)
    payout_method = models.ForeignKey(MerchantPayoutMethod, null=True, on_delete=models.SET_NULL, related_name="+")
    payout_label = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=12, choices=WithdrawalStatus.choices, default=WithdrawalStatus.PENDING)
    requested_at = models.DateField(default=timezone.localdate)
    processed_at = models.DateField(null=True, blank=True)
    reference = models.CharField(max_length=60, blank=True)
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-requested_at", "-id"]
