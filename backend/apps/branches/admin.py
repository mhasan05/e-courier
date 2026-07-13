from django.contrib import admin

from .models import Branch


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "type", "district", "is_active")
    list_filter = ("type", "is_active")
    search_fields = ("code", "name", "district")
