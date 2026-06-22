from django.contrib import admin

from .models import News, NewsCategory, NewsMedia


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


class NewsMediaInline(admin.TabularInline):
    model = NewsMedia
    extra = 0
    readonly_fields = (
        "uploaded_by",
        "created_at",
    )
    fields = (
        "image",
        "alt_text",
        "caption",
        "uploaded_by",
        "created_at",
    )


@admin.register(News)
class NewsAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "category",
        "scope",
        "unit",
        "status",
        "published_at",
        "is_active",
        "is_featured",
        "updated_at",
    )
    list_editable = (
        "status",
        "is_active",
        "is_featured",
    )
    list_filter = (
        "scope",
        "unit",
        "status",
        "is_active",
        "is_featured",
        "category",
        "published_at",
    )
    search_fields = (
        "title",
        "slug",
        "summary",
        "content_text",
        "category__title",
        "unit__title",
    )
    readonly_fields = (
        "content_text",
        "created_by",
        "updated_by",
        "published_by",
        "created_at",
        "updated_at",
    )
    autocomplete_fields = (
        "category",
        "unit",
    )
    date_hierarchy = "published_at"
    save_on_top = True
    inlines = (
        NewsMediaInline,
    )

    fieldsets = (
        (
            "اطلاعات اصلی",
            {
                "fields": (
                    "is_active",
                    "title",
                    "slug",
                    "category",
                    "summary",
                ),
            },
        ),
        (
            "محدوده انتشار",
            {
                "description": (
                    "اگر خبر عمومی مدرسه است scope را school بگذارید و unit را خالی بگذارید. "
                    "اگر خبر مربوط به یک واحد است scope را unit بگذارید و unit را انتخاب کنید."
                ),
                "fields": (
                    "scope",
                    "unit",
                ),
            },
        ),
        (
            "رسانه اصلی",
            {
                "description": (
                    "اگر تصویر کاور تأییدشده برای خبر وجود ندارد، این فیلد را خالی بگذارید."
                ),
                "fields": (
                    "cover_image",
                ),
            },
        ),
        (
            "محتوای خبر",
            {
                "description": (
                    "این فیلد خروجی JSON ادیتور خبر است. مسیر اصلی تولید محتوا، پنل CMS است."
                ),
                "fields": (
                    "content_json",
                    "content_text",
                ),
            },
        ),
        (
            "انتشار",
            {
                "description": (
                    "برای نمایش عمومی خبر، status باید published باشد و تاریخ انتشار، خلاصه و متن خبر تکمیل شده باشند."
                ),
                "fields": (
                    "status",
                    "published_at",
                    "is_featured",
                ),
            },
        ),
        (
            "کاربران",
            {
                "fields": (
                    "created_by",
                    "updated_by",
                    "published_by",
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
        return (
            super()
            .get_queryset(request)
            .select_related("category", "unit", "created_by", "updated_by", "published_by")
        )

    def save_model(self, request, obj, form, change):
        if not change and obj.created_by_id is None:
            obj.created_by = request.user

        obj.updated_by = request.user

        if obj.status == News.Status.PUBLISHED and obj.published_by_id is None:
            obj.published_by = request.user

        super().save_model(request, obj, form, change)


@admin.register(NewsMedia)
class NewsMediaAdmin(admin.ModelAdmin):
    list_display = (
        "__str__",
        "news",
        "uploaded_by",
        "created_at",
    )
    list_filter = (
        "created_at",
    )
    search_fields = (
        "news__title",
        "alt_text",
        "caption",
    )
    readonly_fields = (
        "created_at",
    )
    autocomplete_fields = (
        "news",
        "uploaded_by",
    )