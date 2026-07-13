from django.db import models
from django.utils import timezone


class SupportStatus(models.TextChoices):
    OPEN = "open", "Open"
    IN_PROGRESS = "in_progress", "In Progress"
    RESOLVED = "resolved", "Resolved"
    CLOSED = "closed", "Closed"


class SupportCategory(models.TextChoices):
    PARCEL = "parcel", "Parcel"
    PAYMENT = "payment", "Payment"
    PICKUP = "pickup", "Pickup"
    ACCOUNT = "account", "Account"
    OTHER = "other", "Other"


class SupportPriority(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"


class SupportTicket(models.Model):
    ref = models.CharField(max_length=20, unique=True)
    merchant = models.ForeignKey("merchants.Merchant", on_delete=models.CASCADE, related_name="tickets")
    subject = models.CharField(max_length=200)
    category = models.CharField(max_length=12, choices=SupportCategory.choices, default=SupportCategory.OTHER)
    priority = models.CharField(max_length=8, choices=SupportPriority.choices, default=SupportPriority.MEDIUM)
    status = models.CharField(max_length=12, choices=SupportStatus.choices, default=SupportStatus.OPEN)
    tracking_id = models.CharField(max_length=30, blank=True)
    unread_for_admin = models.BooleanField(default=True)
    unread_for_merchant = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        return f"{self.ref}: {self.subject}"


class SupportMessage(models.Model):
    SENDER = (("merchant", "Merchant"), ("admin", "Admin"))

    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name="messages")
    sender = models.CharField(max_length=10, choices=SENDER)
    sender_name = models.CharField(max_length=120)
    body = models.TextField(blank=True)
    attachment = models.ImageField(upload_to="support/", null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at", "id"]
