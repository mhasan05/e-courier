from django.contrib import admin

from .models import DeliveryMan


@admin.register(DeliveryMan)
class DeliveryManAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "phone", "status", "branch")
    list_filter = ("status", "branch")
    search_fields = ("name", "phone", "user__email")
    raw_id_fields = ("user", "branch")
