from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

from cms.models.pluginmodel import CMSPlugin
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models import ActiveModel, TimeStampedModel
from apps.core.utils import normalize_text


def about_image_upload_to(instance, filename):
    today = timezone.localdate()
    extension = Path(filename).suffix.lower()
    return f"about/{today:%Y/%m}/{uuid4().hex}{extension}"


def validate_http_url(value):
    if not value:
        return

    scheme = urlsplit(value).scheme.lower()
    if scheme not in {"http", "https"}:
        raise ValidationError("آدرس باید با http یا https آغاز شود.")


class AboutPage(TimeStampedModel, ActiveModel):
    title = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="عنوان",
    )
    description = models.TextField(
        null=True,
        blank=True,
        verbose_name="توضیحات",
    )
    image = models.ImageField(
        upload_to=about_image_upload_to,
        null=True,
        blank=True,
        verbose_name="تصویر",
    )
    meta_description = models.CharField(
        max_length=300,
        null=True,
        blank=True,
        verbose_name="توضیحات متا",
    )

    class Meta:
        verbose_name = "صفحه درباره ما"
        verbose_name_plural = "صفحه درباره ما"
        ordering = ("-is_active", "-updated_at", "-id")

    def __str__(self):
        return self.title or "درباره ما"

    def clean(self):
        super().clean()

        nullable_text_fields = (
            "title",
            "description",
            "meta_description",
        )

        for field_name in nullable_text_fields:
            value = getattr(self, field_name)

            if isinstance(value, str):
                value = normalize_text(value)
                setattr(self, field_name, value or None)

        if self.is_active:
            active_queryset = AboutPage.objects.filter(is_active=True)

            if self.pk:
                active_queryset = active_queryset.exclude(pk=self.pk)

            if active_queryset.exists():
                raise ValidationError(
                    {
                        "is_active": "فقط یک رکورد درباره ما می‌تواند فعال باشد.",
                    }
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class RelatedItemsCopyMixin:
    relation_name = "items"

    def copy_relations(self, oldinstance):
        target_manager = getattr(self, self.relation_name)
        source_manager = getattr(oldinstance, self.relation_name)
        target_manager.all().delete()

        for source_item in source_manager.all():
            source_item.pk = None
            source_item.plugin = self
            source_item.save()


class AboutHero(CMSPlugin):
    eyebrow = models.CharField(max_length=120, blank=True, verbose_name="روتیتر")
    title = models.CharField(max_length=255, verbose_name="عنوان")
    subtitle = models.TextField(blank=True, verbose_name="زیرعنوان")
    background_image = models.ImageField(
        upload_to=about_image_upload_to,
        blank=True,
        null=True,
        verbose_name="تصویر پس‌زمینه",
    )
    image_alt = models.CharField(max_length=255, blank=True, verbose_name="متن جایگزین تصویر")
    cta_label = models.CharField(max_length=100, blank=True, verbose_name="متن دکمه")
    cta_url = models.URLField(
        blank=True,
        validators=[validate_http_url],
        verbose_name="لینک دکمه",
    )

    class Meta:
        verbose_name = "Hero درباره ما"
        verbose_name_plural = "Hero درباره ما"

    def __str__(self):
        return self.title


class AboutRichText(CMSPlugin):
    heading = models.CharField(max_length=255, blank=True, verbose_name="عنوان بخش")
    body_html = models.TextField(verbose_name="محتوای HTML")

    class Meta:
        verbose_name = "متن غنی درباره ما"
        verbose_name_plural = "متن‌های غنی درباره ما"

    def __str__(self):
        return self.heading or "متن غنی"


class AboutHistory(RelatedItemsCopyMixin, CMSPlugin):
    heading = models.CharField(max_length=255, default="تاریخچه", verbose_name="عنوان بخش")
    intro = models.TextField(blank=True, verbose_name="مقدمه")

    class Meta:
        verbose_name = "تاریخچه درباره ما"
        verbose_name_plural = "تاریخچه درباره ما"

    def __str__(self):
        return self.heading


class AboutHistoryItem(models.Model):
    plugin = models.ForeignKey(AboutHistory, on_delete=models.CASCADE, related_name="items")
    year = models.CharField(max_length=30, blank=True, verbose_name="سال/دوره")
    title = models.CharField(max_length=255, verbose_name="عنوان")
    description = models.TextField(blank=True, verbose_name="توضیحات")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        ordering = ("order", "id")
        verbose_name = "رویداد تاریخچه"
        verbose_name_plural = "رویدادهای تاریخچه"

    def __str__(self):
        return self.title


class AboutFounders(RelatedItemsCopyMixin, CMSPlugin):
    heading = models.CharField(max_length=255, default="بنیان‌گذاران", verbose_name="عنوان بخش")
    intro = models.TextField(blank=True, verbose_name="مقدمه")

    class Meta:
        verbose_name = "بنیان‌گذاران درباره ما"
        verbose_name_plural = "بنیان‌گذاران درباره ما"

    def __str__(self):
        return self.heading


class AboutFounderItem(models.Model):
    plugin = models.ForeignKey(AboutFounders, on_delete=models.CASCADE, related_name="items")
    full_name = models.CharField(max_length=255, verbose_name="نام و نام خانوادگی")
    role = models.CharField(max_length=150, blank=True, verbose_name="سمت")
    bio = models.TextField(blank=True, verbose_name="معرفی")
    image = models.ImageField(
        upload_to=about_image_upload_to,
        blank=True,
        null=True,
        verbose_name="تصویر",
    )
    image_alt = models.CharField(max_length=255, blank=True, verbose_name="متن جایگزین تصویر")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        ordering = ("order", "id")
        verbose_name = "بنیان‌گذار"
        verbose_name_plural = "بنیان‌گذاران"

    def __str__(self):
        return self.full_name


class AboutValues(RelatedItemsCopyMixin, CMSPlugin):
    heading = models.CharField(max_length=255, default="ارزش‌ها", verbose_name="عنوان بخش")
    intro = models.TextField(blank=True, verbose_name="مقدمه")

    class Meta:
        verbose_name = "ارزش‌های درباره ما"
        verbose_name_plural = "ارزش‌های درباره ما"

    def __str__(self):
        return self.heading


class AboutValueItem(models.Model):
    plugin = models.ForeignKey(AboutValues, on_delete=models.CASCADE, related_name="items")
    title = models.CharField(max_length=255, verbose_name="عنوان")
    description = models.TextField(blank=True, verbose_name="توضیحات")
    icon = models.CharField(max_length=80, blank=True, verbose_name="نام آیکون")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        ordering = ("order", "id")
        verbose_name = "ارزش"
        verbose_name_plural = "ارزش‌ها"

    def __str__(self):
        return self.title


class AboutGoals(RelatedItemsCopyMixin, CMSPlugin):
    heading = models.CharField(max_length=255, default="اهداف", verbose_name="عنوان بخش")
    intro = models.TextField(blank=True, verbose_name="مقدمه")

    class Meta:
        verbose_name = "اهداف درباره ما"
        verbose_name_plural = "اهداف درباره ما"

    def __str__(self):
        return self.heading


class AboutGoalItem(models.Model):
    plugin = models.ForeignKey(AboutGoals, on_delete=models.CASCADE, related_name="items")
    title = models.CharField(max_length=255, verbose_name="عنوان")
    description = models.TextField(blank=True, verbose_name="توضیحات")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        ordering = ("order", "id")
        verbose_name = "هدف"
        verbose_name_plural = "اهداف"

    def __str__(self):
        return self.title


class AboutGallery(RelatedItemsCopyMixin, CMSPlugin):
    heading = models.CharField(max_length=255, default="گالری", verbose_name="عنوان بخش")
    intro = models.TextField(blank=True, verbose_name="مقدمه")

    class Meta:
        verbose_name = "گالری درباره ما"
        verbose_name_plural = "گالری درباره ما"

    def __str__(self):
        return self.heading


class AboutGalleryItem(models.Model):
    plugin = models.ForeignKey(AboutGallery, on_delete=models.CASCADE, related_name="items")
    image = models.ImageField(upload_to=about_image_upload_to, verbose_name="تصویر")
    alt_text = models.CharField(max_length=255, verbose_name="متن جایگزین")
    caption = models.CharField(max_length=255, blank=True, verbose_name="توضیح تصویر")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        ordering = ("order", "id")
        verbose_name = "تصویر گالری"
        verbose_name_plural = "تصاویر گالری"

    def __str__(self):
        return self.caption or self.alt_text


class AboutVideo(CMSPlugin):
    heading = models.CharField(max_length=255, blank=True, verbose_name="عنوان بخش")
    video_url = models.URLField(validators=[validate_http_url], verbose_name="آدرس ویدئو")
    poster = models.ImageField(
        upload_to=about_image_upload_to,
        blank=True,
        null=True,
        verbose_name="پوستر ویدئو",
    )
    caption = models.TextField(blank=True, verbose_name="توضیحات")
    autoplay = models.BooleanField(default=False, verbose_name="پخش خودکار")

    class Meta:
        verbose_name = "ویدئوی درباره ما"
        verbose_name_plural = "ویدئوهای درباره ما"

    def __str__(self):
        return self.heading or "ویدئو"
