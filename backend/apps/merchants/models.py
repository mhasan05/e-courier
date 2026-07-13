import hashlib
import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone


def generate_api_key() -> str:
    """Public API-Key identifier (sent in the `Api-Key` header, safe to display)."""
    return secrets.token_hex(15)  # 30 hex chars


def generate_secret_key() -> str:
    """Secret key (sent in the `Secret-Key` header; only its hash is stored)."""
    return secrets.token_hex(20)  # 40 hex chars


def hash_api_key(raw: str) -> str:
    """SHA-256 of a secret — only the hash is stored (keys are high-entropy)."""
    return hashlib.sha256(raw.encode()).hexdigest()


class MerchantStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACTIVE = "active", "Active"
    SUSPENDED = "suspended", "Suspended"


class Merchant(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="merchant"
    )
    name = models.CharField(max_length=150)  # owner full name
    shop_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30, blank=True)
    address = models.CharField(max_length=255, blank=True)
    district = models.CharField(max_length=80, blank=True)
    business_type = models.CharField(max_length=120, blank=True)
    status = models.CharField(
        max_length=12, choices=MerchantStatus.choices, default=MerchantStatus.PENDING
    )
    join_date = models.DateField(default=timezone.localdate)
    cod_collected = models.IntegerField(default=0)
    cod_disbursed = models.IntegerField(default=0)
    cod_pending = models.IntegerField(default=0)
    home_branch = models.ForeignKey(
        "branches.Branch", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="merchants",
    )

    class Meta:
        ordering = ["-join_date", "id"]

    def __str__(self):
        return f"{self.shop_name} ({self.name})"

    @property
    def email(self):
        return self.user.email


class MerchantApiKey(models.Model):
    """API credentials a merchant uses to integrate parcel booking on their site.

    Follows the Steadfast convention of a public `Api-Key` (an identifier, safe
    to display) plus a `Secret-Key` (shown once, only its SHA-256 hash stored).
    """

    merchant = models.ForeignKey(
        Merchant, on_delete=models.CASCADE, related_name="api_keys"
    )
    label = models.CharField(max_length=100, blank=True)
    api_key = models.CharField(
        max_length=64, unique=True, db_index=True, default=generate_api_key
    )
    secret_hash = models.CharField(max_length=64, default="")
    is_active = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.api_key[:10]}… ({self.merchant.shop_name})"

    @classmethod
    def issue(cls, merchant, label=""):
        """Create credentials and return (instance, api_key, secret_key).
        The secret key is not stored — only its hash."""
        api_key = generate_api_key()
        secret_key = generate_secret_key()
        obj = cls.objects.create(
            merchant=merchant,
            label=label or "API key",
            api_key=api_key,
            secret_hash=hash_api_key(secret_key),
        )
        return obj, api_key, secret_key


class MerchantWebhook(models.Model):
    """A merchant's callback endpoint for parcel event pushes.

    We POST JSON `notification_type` payloads to `url`; if `auth_token` is set
    we send it as `Authorization: Bearer <auth_token>` so the merchant can
    verify the call came from us.
    """

    merchant = models.OneToOneField(
        Merchant, on_delete=models.CASCADE, related_name="webhook"
    )
    url = models.URLField(max_length=500, blank=True)
    auth_token = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"webhook<{self.merchant.shop_name}>"


class WebhookDelivery(models.Model):
    """Audit log of a single webhook POST attempt."""

    merchant = models.ForeignKey(
        Merchant, on_delete=models.CASCADE, related_name="webhook_deliveries"
    )
    event = models.CharField(max_length=50)
    tracking_id = models.CharField(max_length=40, blank=True)
    ok = models.BooleanField(default=False)
    status_code = models.IntegerField(null=True, blank=True)
    error = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
