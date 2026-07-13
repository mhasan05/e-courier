from django.contrib import admin

from .models import Zone


@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = ("name", "regular_charge", "express_charge", "cod_charge_percent", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)
