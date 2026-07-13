from django.contrib import admin

from .models import Parcel, ParcelStatusEvent


class EventInline(admin.TabularInline):
    model = ParcelStatusEvent
    extra = 0


@admin.register(Parcel)
class ParcelAdmin(admin.ModelAdmin):
    list_display = ("tracking_id", "recipient_name", "status", "cod_amount", "owner_branch", "delivery_man")
    list_filter = ("status", "delivery_type", "owner_branch")
    search_fields = ("tracking_id", "recipient_name", "recipient_phone")
    raw_id_fields = ("merchant", "delivery_man", "origin_branch", "destination_branch", "current_branch", "owner_branch")
    inlines = [EventInline]
