from django.contrib import admin

from .models import PanelService


@admin.register(PanelService)
class PanelServiceAdmin(admin.ModelAdmin):
    list_display = ("title", "is_active", "is_external", "order")
    list_filter = ("is_active", "is_external")
    search_fields = ("title", "description", "url")
