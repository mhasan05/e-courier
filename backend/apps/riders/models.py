from django.conf import settings
from django.db import models
from django.utils import timezone

DEFAULT_RIDER_PASSWORD = "12345678"


class DeliveryManStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"


class DeliveryMan(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="delivery_man"
    )
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30, blank=True)
    nid = models.CharField(max_length=40, blank=True)
    passport = models.CharField(max_length=40, blank=True)
    photo = models.ImageField(upload_to="riders/photos/", null=True, blank=True)
    nid_image = models.ImageField(upload_to="riders/nid/", null=True, blank=True)
    passport_image = models.ImageField(upload_to="riders/passport/", null=True, blank=True)
    status = models.CharField(
        max_length=10, choices=DeliveryManStatus.choices, default=DeliveryManStatus.ACTIVE
    )
    branch = models.ForeignKey(
        "branches.Branch", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="riders",
    )
    # Delivery areas this rider covers (subset of their hub's coverage_thanas),
    # stored as "District/Thana" keys. Set by the hub manager.
    areas = models.JSONField(default=list, blank=True)
    created_at = models.DateField(default=timezone.localdate)

    class Meta:
        ordering = ["-created_at", "id"]

    def __str__(self):
        return f"{self.name} ({self.phone})"

    @property
    def email(self):
        return self.user.email
