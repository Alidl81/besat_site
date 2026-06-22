from django.contrib import admin

from .models import News, NewsCategory


@admin.register(NewsCategory)
class NewsCategoryAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "slug",
        "order",
        "is_active",
    )
    list_editable = (
        "order",
        "is_active",
    )
    list_filter = (
        "is_active",
    )
    search_fields = (
        "title",
        "slug",
    )

    fieldsets = (
        (
            "اطلاعات اصلی",
            {
                "fields": (
                    "is_active",
                    "title",
                    "slug",
                ),
            },
        ),
        (
            "نمایش و مرتب‌سازی",
            {
                "fields": (
                    "order",
                ),
            },
        ),
    )


@admin.register
class NewsAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "category",
        "published_at",
        "is_published",
        "is_featured",
        "updated_at",
    )
    list_editable = (
        "is_published",
        "is_featured",
    )
    list_filter = (
        "is_published",
        "is_featured",
        "category",
        "published_at",
    )
    search_fields = (
        "title",
        "slug",
        "summary",
        "content",
        "category__title",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    autocomplete_fields = (
        "category",
    )
    date_hierarchy = "published_at"
    save_on_top = True

    fieldsets = (
        (
            "اطلاعات اصلی",
            {
                "fields": (
                    "title",
                    "slug",
                    "category",
                    "summary",
                    "content",
                ),
            },
        ),
        (
            "رسانه",
            {
                "description": (
                    "اگر تصویر تأییدشده برای خبر وجود ندارد، این فیلد را خالی بگذارید. "
                    "API در این حالت مقدار null برمی‌گرداند."
                ),
                "fields": (
                    "cover_image",
                ),
            },
        ),
        (
            "انتشار",
            {
                "description": (
                    "برای نمایش عمومی خبر، گزینه منتشر شده باید فعال باشد و تاریخ انتشار، خلاصه و متن کامل خبر تکمیل شده باشند."
                ),
                "fields": (
                    "published_at",
                    "is_published",
                    "is_featured",
                ),
            },
        ),
        (
            "تاریخ‌ها",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("category")