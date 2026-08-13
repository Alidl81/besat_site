from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.core.models import (
    ActiveModel,
    ContentWorkflowModel,
    OrderedModel,
    SEOFieldsModel,
    TimeStampedModel,
)
from apps.core.utils import normalize_text

from ..sanitize import sanitize_product_html
from ..validators import validate_product_image_file


def product_featured_image_upload_to(instance, filename):
    today = timezone.localdate()
    extension = Path(filename).suffix.lower()
    return f"shop/products/covers/{today:%Y/%m}/{uuid4().hex}{extension}"


def product_gallery_image_upload_to(instance, filename):
    today = timezone.localdate()
    extension = Path(filename).suffix.lower()
    return f"shop/products/gallery/{today:%Y/%m}/{uuid4().hex}{extension}"


def category_cover_upload_to(instance, filename):
    today = timezone.localdate()
    extension = Path(filename).suffix.lower()
    return f"shop/categories/{today:%Y/%m}/{uuid4().hex}{extension}"


class ShopCategory(TimeStampedModel, ActiveModel, OrderedModel):
    title = models.CharField(max_length=255, verbose_name="عنوان دسته‌بندی")
    slug = models.SlugField(
        max_length=255,
        unique=True,
        allow_unicode=True,
        blank=True,
        verbose_name="اسلاگ",
        help_text="اگر خالی بماند، از عنوان ساخته می‌شود.",
    )
    description = models.TextField(null=True, blank=True, verbose_name="توضیحات")
    cover_image = models.ImageField(
        upload_to=category_cover_upload_to,
        validators=[validate_product_image_file],
        null=True,
        blank=True,
        verbose_name="تصویر کاور",
    )
    cover_image_url = models.TextField(null=True, blank=True, verbose_name="نشانی تصویر کاور")

    class Meta:
        verbose_name = "دسته‌بندی فروشگاه"
        verbose_name_plural = "دسته‌بندی‌های فروشگاه"
        ordering = ("order", "id")
        indexes = [models.Index(fields=("is_active", "order"))]

    def __str__(self):
        return self.title

    def clean(self):
        super().clean()
        self.title = normalize_text(self.title)
        self.slug = normalize_text(self.slug)

        if isinstance(self.description, str):
            self.description = normalize_text(self.description) or None
        if isinstance(self.cover_image_url, str):
            self.cover_image_url = self.cover_image_url.strip() or None

        if not self.title:
            raise ValidationError({"title": "عنوان دسته‌بندی الزامی است."})

    def save(self, *args, **kwargs):
        self.full_clean(validate_unique=False, validate_constraints=False)
        if not self.slug:
            self.slug = self._generate_unique_slug()
        self.full_clean(validate_unique=True, validate_constraints=True)
        super().save(*args, **kwargs)

    def _generate_unique_slug(self):
        base_slug = slugify(self.title, allow_unicode=True) or "shop-category"
        slug = base_slug
        counter = 2
        queryset = ShopCategory.objects.all()
        if self.pk:
            queryset = queryset.exclude(pk=self.pk)
        while queryset.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        return slug


class Product(TimeStampedModel, ActiveModel, OrderedModel, SEOFieldsModel, ContentWorkflowModel):
    """Shared catalog record for every sellable item. Type-specific data
    (inventory, course schedule, ...) lives in a one-to-one detail table
    (see PhysicalProductDetail / OnlineCourseDetail / InPersonCourseDetail)
    rather than as always-null columns on this model -- keeps validation
    and serialization for each product type isolated."""

    class ProductType(models.TextChoices):
        PHYSICAL = "physical", "کالای فیزیکی"
        ONLINE_COURSE = "online_course", "دوره آنلاین"
        IN_PERSON_COURSE = "in_person_course", "دوره حضوری"

    product_type = models.CharField(
        max_length=30,
        choices=ProductType.choices,
        db_index=True,
        verbose_name="نوع محصول",
        help_text="پس از ایجاد محصول قابل تغییر نیست.",
    )
    title = models.CharField(max_length=255, verbose_name="عنوان")
    slug = models.SlugField(
        max_length=255,
        unique=True,
        allow_unicode=True,
        blank=True,
        verbose_name="اسلاگ",
    )
    category = models.ForeignKey(
        ShopCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
        verbose_name="دسته‌بندی",
    )
    tags = models.JSONField(default=list, blank=True, verbose_name="برچسب‌ها")
    short_description = models.CharField(
        max_length=500, null=True, blank=True, verbose_name="توضیح کوتاه"
    )
    description = models.TextField(
        null=True,
        blank=True,
        verbose_name="توضیحات کامل",
        help_text="HTML ضدعفونی‌شده تولید‌شده توسط ویرایشگر Tiptap.",
    )
    featured_image = models.ImageField(
        upload_to=product_featured_image_upload_to,
        validators=[validate_product_image_file],
        null=True,
        blank=True,
        verbose_name="تصویر شاخص",
    )
    featured_image_url = models.TextField(null=True, blank=True, verbose_name="نشانی تصویر شاخص")
    price_amount = models.PositiveBigIntegerField(
        null=True,
        blank=True,
        verbose_name="قیمت (ریال)",
        help_text="مقدار صحیح به ریال. برای انتشار محصول الزامی است.",
    )
    sale_price_amount = models.PositiveBigIntegerField(
        null=True,
        blank=True,
        verbose_name="قیمت ویژه (ریال)",
    )
    is_featured = models.BooleanField(default=False, db_index=True, verbose_name="محصول ویژه؟")
    is_important = models.BooleanField(default=False, db_index=True, verbose_name="محصول مهم؟")
    published_at = models.DateField(null=True, blank=True, db_index=True, verbose_name="تاریخ انتشار")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_shop_products",
        verbose_name="ایجادکننده",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_shop_products",
        verbose_name="آخرین ویرایش‌کننده",
    )
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="published_shop_products",
        verbose_name="منتشرکننده",
    )

    class Meta:
        verbose_name = "محصول فروشگاه"
        verbose_name_plural = "محصولات فروشگاه"
        ordering = ("order", "-published_at", "-id")
        indexes = [
            models.Index(fields=("status", "published_at")),
            models.Index(fields=("product_type", "status")),
            models.Index(fields=("is_featured", "published_at")),
            models.Index(fields=("category", "status")),
            models.Index(fields=("is_active", "status")),
        ]

    def __str__(self):
        return self.title

    def clean(self):
        super().clean()
        self.title = normalize_text(self.title)
        self.slug = normalize_text(self.slug)

        for field_name in ("short_description", "featured_image_url"):
            value = getattr(self, field_name)
            if isinstance(value, str):
                setattr(self, field_name, normalize_text(value) or None)

        if isinstance(self.description, str):
            self.description = sanitize_product_html(self.description) or None

        errors = {}

        if not self.title:
            errors["title"] = "عنوان محصول الزامی است."

        if self.pk:
            original_type = (
                Product.objects.filter(pk=self.pk).values_list("product_type", flat=True).first()
            )
            if original_type and original_type != self.product_type:
                errors["product_type"] = "نوع محصول پس از ایجاد قابل تغییر نیست."

        if (
            self.sale_price_amount is not None
            and self.price_amount is not None
            and self.sale_price_amount >= self.price_amount
        ):
            errors["sale_price_amount"] = "قیمت ویژه باید کمتر از قیمت اصلی باشد."

        if self.status == self.Status.PUBLISHED:
            if self.price_amount is None:
                errors["price_amount"] = "برای انتشار محصول، قیمت الزامی است."
            if not self.short_description:
                errors["short_description"] = "برای انتشار محصول، توضیح کوتاه الزامی است."
            if not self.description:
                errors["description"] = "برای انتشار محصول، توضیحات کامل الزامی است."
            if self.category and not self.category.is_active:
                errors["category"] = "محصول منتشرشده نباید در دسته‌بندی غیرفعال باشد."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean(validate_unique=False, validate_constraints=False)
        if not self.slug:
            self.slug = self._generate_unique_slug()
        self.full_clean(validate_unique=True, validate_constraints=True)
        super().save(*args, **kwargs)

    def _generate_unique_slug(self):
        base_slug = slugify(self.title, allow_unicode=True) or "product"
        slug = base_slug
        counter = 2
        queryset = Product.objects.all()
        if self.pk:
            queryset = queryset.exclude(pk=self.pk)
        while queryset.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        return slug

    @property
    def is_physical(self) -> bool:
        return self.product_type == self.ProductType.PHYSICAL

    @property
    def is_course(self) -> bool:
        return self.product_type in (
            self.ProductType.ONLINE_COURSE,
            self.ProductType.IN_PERSON_COURSE,
        )


class ProductImage(TimeStampedModel, OrderedModel):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="gallery_images",
        verbose_name="محصول",
    )
    image = models.ImageField(
        upload_to=product_gallery_image_upload_to,
        validators=[validate_product_image_file],
        null=True,
        blank=True,
        verbose_name="تصویر",
    )
    image_url = models.TextField(null=True, blank=True, verbose_name="نشانی تصویر")
    alt_text = models.CharField(max_length=255, null=True, blank=True, verbose_name="متن جایگزین")
    caption = models.CharField(max_length=500, null=True, blank=True, verbose_name="کپشن")

    class Meta:
        verbose_name = "تصویر گالری محصول"
        verbose_name_plural = "تصاویر گالری محصول"
        ordering = ("order", "id")
        indexes = [models.Index(fields=("product", "order"))]

    def __str__(self):
        return self.caption or self.alt_text or f"تصویر محصول #{self.pk}"

    def clean(self):
        super().clean()
        for field_name in ("alt_text", "caption", "image_url"):
            value = getattr(self, field_name)
            if isinstance(value, str):
                setattr(self, field_name, normalize_text(value) or None)

        if not self.image and not self.image_url:
            raise ValidationError({"image": "فایل تصویر یا نشانی تصویر الزامی است."})


class ProductVariant(TimeStampedModel, ActiveModel, OrderedModel):
    """Physical products only -- validated in clean()."""

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="variants",
        verbose_name="محصول",
    )
    sku = models.CharField(max_length=100, unique=True, verbose_name="کد کالا (SKU)")
    title = models.CharField(max_length=255, verbose_name="عنوان گزینه")
    price_override_amount = models.PositiveBigIntegerField(
        null=True,
        blank=True,
        verbose_name="قیمت جایگزین (ریال)",
        help_text="خالی بماند تا قیمت محصول اصلی استفاده شود.",
    )
    inventory_qty = models.PositiveIntegerField(default=0, verbose_name="موجودی")
    attributes = models.JSONField(
        default=dict, blank=True, verbose_name="ویژگی‌ها", help_text="مثال: {\"size\": \"L\"}"
    )

    class Meta:
        verbose_name = "گزینه محصول"
        verbose_name_plural = "گزینه‌های محصول"
        ordering = ("order", "id")
        indexes = [models.Index(fields=("product", "is_active"))]

    def __str__(self):
        return f"{self.product.title} - {self.title}"

    def clean(self):
        super().clean()
        self.sku = normalize_text(self.sku)
        self.title = normalize_text(self.title)

        errors = {}
        if not self.sku:
            errors["sku"] = "کد کالا الزامی است."
        if not self.title:
            errors["title"] = "عنوان گزینه الزامی است."
        if self.product_id and self.product.product_type != Product.ProductType.PHYSICAL:
            errors["product"] = "گزینه محصول فقط برای کالای فیزیکی مجاز است."
        if errors:
            raise ValidationError(errors)


class PhysicalProductDetail(TimeStampedModel):
    class Availability(models.TextChoices):
        IN_STOCK = "in_stock", "موجود"
        LOW_STOCK = "low_stock", "موجودی کم"
        OUT_OF_STOCK = "out_of_stock", "ناموجود"
        PREORDER = "preorder", "پیش‌فروش"
        DISCONTINUED = "discontinued", "متوقف‌شده"

    product = models.OneToOneField(
        Product,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="physical_detail",
        verbose_name="محصول",
    )
    sku = models.CharField(max_length=100, unique=True, verbose_name="کد کالا (SKU)")
    inventory_qty = models.PositiveIntegerField(default=0, verbose_name="موجودی انبار")
    low_stock_threshold = models.PositiveIntegerField(default=5, verbose_name="آستانه موجودی کم")
    availability = models.CharField(
        max_length=20,
        choices=Availability.choices,
        default=Availability.IN_STOCK,
        db_index=True,
        verbose_name="وضعیت موجودی",
        help_text="به‌جز preorder/discontinued، بقیه مقادیر توسط سیستم محاسبه می‌شوند.",
    )
    weight_grams = models.PositiveIntegerField(null=True, blank=True, verbose_name="وزن (گرم)")
    length_mm = models.PositiveIntegerField(null=True, blank=True, verbose_name="طول (میلی‌متر)")
    width_mm = models.PositiveIntegerField(null=True, blank=True, verbose_name="عرض (میلی‌متر)")
    height_mm = models.PositiveIntegerField(null=True, blank=True, verbose_name="ارتفاع (میلی‌متر)")
    requires_shipping = models.BooleanField(default=True, verbose_name="نیاز به ارسال دارد؟")
    max_purchase_quantity = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="حداکثر تعداد خرید",
        help_text="خالی یعنی بدون محدودیت.",
    )

    class Meta:
        verbose_name = "جزئیات کالای فیزیکی"
        verbose_name_plural = "جزئیات کالاهای فیزیکی"

    def __str__(self):
        return f"جزئیات فیزیکی: {self.product.title}"

    def clean(self):
        super().clean()
        self.sku = normalize_text(self.sku)
        if not self.sku:
            raise ValidationError({"sku": "کد کالا الزامی است."})

    def recompute_availability(self, *, commit: bool = True) -> None:
        """Service-maintained: called after any inventory change. Leaves
        admin-set preorder/discontinued overrides untouched."""
        if self.availability in (self.Availability.PREORDER, self.Availability.DISCONTINUED):
            return

        if self.inventory_qty <= 0:
            self.availability = self.Availability.OUT_OF_STOCK
        elif self.inventory_qty <= self.low_stock_threshold:
            self.availability = self.Availability.LOW_STOCK
        else:
            self.availability = self.Availability.IN_STOCK

        if commit:
            self.save(update_fields=["availability", "updated_at"])
