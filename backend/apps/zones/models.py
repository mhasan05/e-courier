from django.db import models


class Zone(models.Model):
    name = models.CharField(max_length=80)
    districts = models.JSONField(default=list, blank=True)
    regular_charge = models.IntegerField(default=0)
    express_charge = models.IntegerField(default=0)
    cod_charge_percent = models.FloatField(default=1.0)
    return_charge = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.name
