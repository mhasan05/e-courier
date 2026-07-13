from django.db import models
from django.utils import timezone


class RemittanceStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    RECEIVED = "received", "Received"


class HubRemittance(models.Model):
    """Hub → HQ cash remittance."""

    branch = models.ForeignKey("branches.Branch", on_delete=models.CASCADE, related_name="remittances")
    amount = models.IntegerField(default=0)
    parcel_count = models.IntegerField(default=0)
    reference = models.CharField(max_length=60, blank=True)
    status = models.CharField(max_length=12, choices=RemittanceStatus.choices, default=RemittanceStatus.PENDING)
    note = models.CharField(max_length=255, blank=True)
    remitted_at = models.DateField(default=timezone.localdate)
    received_at = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["-remitted_at", "-id"]


class RiderHandover(models.Model):
    """Rider → hub cash handover (mirrors the hub → HQ remittance)."""

    rider = models.ForeignKey("riders.DeliveryMan", on_delete=models.CASCADE, related_name="handovers")
    rider_name = models.CharField(max_length=150)
    branch = models.ForeignKey("branches.Branch", null=True, blank=True, on_delete=models.SET_NULL, related_name="rider_handovers")
    amount = models.IntegerField(default=0)
    parcel_count = models.IntegerField(default=0)
    parcel_ids = models.JSONField(default=list, blank=True)
    reference = models.CharField(max_length=60, blank=True)
    status = models.CharField(max_length=12, choices=RemittanceStatus.choices, default=RemittanceStatus.PENDING)
    remitted_at = models.DateField(default=timezone.localdate)
    received_at = models.DateField(null=True, blank=True)
    confirmed_by = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["-remitted_at", "-id"]
