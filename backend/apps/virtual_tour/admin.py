from django.contrib import admin

from .models import TourHotspot, TourScene


class TourHotspotInline(admin.TabularInline):
    model = TourHotspot
    fk_name = "scene"
    extra = 0


@admin.register(TourScene)
class TourSceneAdmin(admin.ModelAdmin):
    list_display = ("title", "unit", "department", "status", "is_default", "is_active", "order")
    list_filter = ("status", "is_active", "is_default")
    search_fields = ("title", "slug", "unit__title", "department__title")
    inlines = [TourHotspotInline]


@admin.register(TourHotspot)
class TourHotspotAdmin(admin.ModelAdmin):
    list_display = ("scene", "target_scene", "label", "order")
    search_fields = ("scene__title", "target_scene__title", "label")
