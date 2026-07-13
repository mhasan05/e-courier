from django.contrib import admin

from .models import Merchant


@admin.register(Merchant)
class MerchantAdmin(admin.ModelAdmin):
    list_display = ("id", "shop_name", "name", "status", "district", "home_branch")
    list_filter = ("status", "district")
    search_fields = ("name", "shop_name", "user__email", "phone")
    raw_id_fields = ("user", "home_branch")
