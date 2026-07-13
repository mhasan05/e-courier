from django.db import models


class BranchType(models.TextChoices):
    CENTRAL = "central", "Central"
    HUB = "hub", "Hub"


class Branch(models.Model):
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=20, unique=True)  # e.g. "DHK-CEN"
    type = models.CharField(max_length=10, choices=BranchType.choices, default=BranchType.HUB)
    phone = models.CharField(max_length=30, blank=True)
    address = models.CharField(max_length=255, blank=True)
    district = models.CharField(max_length=80)
    thana = models.CharField(max_length=80, blank=True)
    # Qualified "District/Thana" coverage keys (thana names aren't globally unique).
    coverage_thanas = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.name} ({self.code})"
