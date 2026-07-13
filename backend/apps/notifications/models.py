from django.db import models
from django.utils import timezone


class NotificationType(models.TextChoices):
    ASSIGNMENT = "assignment", "Assignment"
    REASSIGNMENT = "reassignment", "Reassignment"


class RiderNotification(models.Model):
    rider = models.ForeignKey("riders.DeliveryMan", on_delete=models.CASCADE, related_name="notifications")
    type = models.CharField(max_length=14, choices=NotificationType.choices, default=NotificationType.ASSIGNMENT)
    title = models.CharField(max_length=120)
    body = models.CharField(max_length=255, blank=True)
    parcel = models.ForeignKey("parcels.Parcel", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    tracking_id = models.CharField(max_length=30, blank=True)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]
