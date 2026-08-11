from django.contrib import admin

from .models import (
    Address,
    Cart,
    CartItem,
    CourseEnrollment,
    InPersonCourseDetail,
    OnlineCourseDetail,
    Order,
    OrderEvent,
    OrderItem,
    PaymentAttempt,
    PaymentTransaction,
    PhysicalProductDetail,
    Product,
    ProductImage,
    ProductVariant,
    ShippingMethod,
    ShopCategory,
    ShopSettings,
    StockReservation,
)


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0
    fields = ("image", "image_url", "alt_text", "caption", "order")


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 0
    fields = ("sku", "title", "price_override_amount", "inventory_qty", "attributes", "is_active", "order")


class PhysicalProductDetailInline(admin.StackedInline):
    model = PhysicalProductDetail
    extra = 0
    can_delete = False


class OnlineCourseDetailInline(admin.StackedInline):
    model = OnlineCourseDetail
    extra = 0
    can_delete = False


class InPersonCourseDetailInline(admin.StackedInline):
    model = InPersonCourseDetail
    extra = 0
    can_delete = False


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "product_type",
        "category",
        "status",
        "price_amount",
        "is_active",
        "is_featured",
        "updated_at",
    )
    list_filter = ("product_type", "status", "is_active", "is_featured", "category")
    search_fields = ("title", "slug", "short_description")
    readonly_fields = ("created_by", "updated_by", "published_by", "created_at", "updated_at")
    autocomplete_fields = ("category",)
    date_hierarchy = "published_at"
    save_on_top = True
    inlines = [
        ProductImageInline,
        ProductVariantInline,
        PhysicalProductDetailInline,
        OnlineCourseDetailInline,
        InPersonCourseDetailInline,
    ]

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("category", "created_by", "updated_by")

    def save_model(self, request, obj, form, change):
        if not change and obj.created_by_id is None:
            obj.created_by = request.user
        obj.updated_by = request.user
        if obj.status == Product.Status.PUBLISHED and obj.published_by_id is None:
            obj.published_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(ShopCategory)
class ShopCategoryAdmin(admin.ModelAdmin):
    list_display = ("title", "is_active", "order")
    list_editable = ("is_active", "order")
    search_fields = ("title", "slug")


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    readonly_fields = (
        "product", "variant", "product_type_snapshot", "title_snapshot",
        "sku_snapshot", "unit_price_amount_snapshot", "quantity", "line_total_amount",
    )


class OrderEventInline(admin.TabularInline):
    model = OrderEvent
    extra = 0
    can_delete = False
    readonly_fields = ("event_type", "from_status", "to_status", "actor", "message", "created_at")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "user", "status", "total_amount", "requires_shipping", "created_at")
    list_filter = ("status", "requires_shipping")
    search_fields = ("order_number", "user__username", "user__email")
    readonly_fields = ("order_number", "subtotal_amount", "total_amount", "created_at", "updated_at")
    date_hierarchy = "created_at"
    inlines = [OrderItemInline, OrderEventInline]

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("user", "shipping_method")

    def has_add_permission(self, request):
        # Orders are only ever created by checkout_service, never by hand.
        return False


@admin.register(PaymentAttempt)
class PaymentAttemptAdmin(admin.ModelAdmin):
    list_display = ("order", "provider", "status", "amount_amount", "created_at")
    list_filter = ("provider", "status")
    search_fields = ("order__order_number", "provider_reference", "idempotency_key")
    readonly_fields = [f.name for f in PaymentAttempt._meta.fields]

    def has_add_permission(self, request):
        return False


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ("attempt", "transaction_type", "result", "created_at")
    list_filter = ("transaction_type", "result")
    readonly_fields = [f.name for f in PaymentTransaction._meta.fields]

    def has_add_permission(self, request):
        return False


@admin.register(CourseEnrollment)
class CourseEnrollmentAdmin(admin.ModelAdmin):
    list_display = ("user", "product", "status", "is_confirmed", "granted_at")
    list_filter = ("status", "is_confirmed")
    search_fields = ("user__username", "user__email", "product__title")
    autocomplete_fields = ("user", "product")


@admin.register(ShippingMethod)
class ShippingMethodAdmin(admin.ModelAdmin):
    list_display = ("title", "price_amount", "is_default", "is_active", "order")
    list_editable = ("is_active", "order")


@admin.register(ShopSettings)
class ShopSettingsAdmin(admin.ModelAdmin):
    list_display = ("reservation_hold_minutes", "mock_payment_enabled")

    def has_add_permission(self, request):
        return not ShopSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


admin.site.register(Cart)
admin.site.register(CartItem)
admin.site.register(Address)
admin.site.register(StockReservation)
