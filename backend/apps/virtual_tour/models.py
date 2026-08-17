from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.core.models import ActiveModel, ContentWorkflowModel, OrderedModel, TimeStampedModel
from apps.core.utils import normalize_text

from .validators import validate_panorama_image_file, validate_thumbnail_image_file


def panorama_upload_to(instance, filename):
    today = timezone.localdate()
    extension = Path(filename).suffix.lower()
    return f"virtual-tour/panoramas/{today:%Y/%m}/{uuid4().hex}{extension}"


def thumbnail_upload_to(instance, filename):
    today = timezone.localdate()
    extension = Path(filename).suffix.lower()
    return f"virtual-tour/thumbnails/{today:%Y/%m}/{uuid4().hex}{extension}"


class TourScene(
    TimeStampedModel,
    ActiveModel,
    OrderedModel,
    ContentWorkflowModel,
):
    """One panorama/room inside a unit's or department's virtual tour
    ("door"). A door may have one or many scenes; hotspots (see
    TourHotspot) link scenes to each other within the same door. Exactly
    one of `unit` / `department` must be set -- this mirrors the existing
    frontend convention (tour-config.ts keys scenes "unit:<slug>" or
    "department:<slug>"), just moved into the database."""

    title = models.CharField(max_length=255, verbose_name="عنوان صحنه")
    slug = models.SlugField(max_length=255, unique=True, allow_unicode=True, blank=True, verbose_name="اسلاگ")
    description = models.TextField(null=True, blank=True, verbose_name="توضیحات")

    unit = models.ForeignKey(
        "units.SchoolUnit",
        on_delete=models.CASCADE,
        related_name="tour_scenes",
        null=True,
        blank=True,
        verbose_name="واحد آموزشی",
    )
    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.CASCADE,
        related_name="tour_scenes",
        null=True,
        blank=True,
        verbose_name="دپارتمان",
    )

    panorama = models.ImageField(
        upload_to=panorama_upload_to,
        validators=[validate_panorama_image_file],
        null=True,
        blank=True,
        verbose_name="تصویر پانورامای ۳۶۰ درجه",
    )
    thumbnail = models.ImageField(
        upload_to=thumbnail_upload_to,
        validators=[validate_thumbnail_image_file],
        null=True,
        blank=True,
        verbose_name="تصویر بندانگشتی",
    )

    initial_yaw = models.FloatField(default=0, verbose_name="زاویه افقی شروع")
    initial_pitch = models.FloatField(default=0, verbose_name="زاویه عمودی شروع")
    initial_hfov = models.FloatField(default=105, verbose_name="زاویه دید افقی شروع")

    is_default = models.BooleanField(default=False, db_index=True, verbose_name="صحنه پیش‌فرض این در؟")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_tour_scenes",
        verbose_name="ایجادکننده",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_tour_scenes",
        verbose_name="آخرین ویرایش‌کننده",
    )
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="published_tour_scenes",
        verbose_name="منتشرکننده",
    )
    published_at = models.DateField(null=True, blank=True, verbose_name="تاریخ انتشار")

    class Meta:
        verbose_name = "صحنه تور مجازی"
        verbose_name_plural = "صحنه‌های تور مجازی"
        ordering = ("unit_id", "department_id", "order", "id")
        indexes = [
            models.Index(fields=("unit", "status")),
            models.Index(fields=("department", "status")),
            models.Index(fields=("is_active", "status")),
        ]

    def __str__(self):
        return self.title

    @property
    def door_key(self) -> str | None:
        if self.unit_id:
            return f"unit:{self.unit.slug}"
        if self.department_id:
            return f"department:{self.department.slug}"
        return None

    def clean(self):
        super().clean()

        self.title = normalize_text(self.title)
        self.slug = normalize_text(self.slug)
        if isinstance(self.description, str):
            self.description = normalize_text(self.description) or None

        errors = {}

        if not self.title:
            errors["title"] = "عنوان صحنه الزامی است."

        if bool(self.unit_id) == bool(self.department_id):
            errors["unit"] = "صحنه باید دقیقاً به یک واحد آموزشی یا یک دپارتمان وصل باشد، نه هر دو یا هیچ‌کدام."

        if self.status == self.Status.PUBLISHED:
            if not self.panorama:
                errors["panorama"] = "برای انتشار صحنه، تصویر پانوراما الزامی است."
            if not self.published_at:
                errors["published_at"] = "برای انتشار صحنه، تاریخ انتشار الزامی است."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean(validate_unique=False, validate_constraints=False)

        if not self.slug:
            self.slug = self._generate_unique_slug()

        self.full_clean(validate_unique=True, validate_constraints=True)

        with transaction.atomic():
            super().save(*args, **kwargs)

            if self.is_default:
                door_filter = {"unit_id": self.unit_id} if self.unit_id else {"department_id": self.department_id}
                TourScene.objects.filter(**door_filter).exclude(pk=self.pk).update(is_default=False)

    def _generate_unique_slug(self):
        base_slug = slugify(self.title, allow_unicode=True) or "tour-scene"
        slug = base_slug
        counter = 2

        queryset = TourScene.objects.all()
        if self.pk:
            queryset = queryset.exclude(pk=self.pk)

        while queryset.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        return slug


class TourHotspot(TimeStampedModel, OrderedModel):
    """A clickable link from one scene to another, positioned by yaw/pitch
    on the source scene's equirectangular panorama (the same coordinate
    system pannellum's hotSpots config and mouseEventToCoords() use)."""

    scene = models.ForeignKey(
        TourScene,
        on_delete=models.CASCADE,
        related_name="hotspots",
        verbose_name="صحنه مبدأ",
    )
    target_scene = models.ForeignKey(
        TourScene,
        on_delete=models.CASCADE,
        related_name="incoming_hotspots",
        verbose_name="صحنه مقصد",
    )
    yaw = models.FloatField(verbose_name="زاویه افقی")
    pitch = models.FloatField(verbose_name="زاویه عمودی")
    label = models.CharField(max_length=100, blank=True, verbose_name="برچسب")

    class Meta:
        verbose_name = "نقطه اتصال تور مجازی"
        verbose_name_plural = "نقاط اتصال تور مجازی"
        ordering = ("scene_id", "order", "id")
        indexes = [models.Index(fields=("scene",))]

    def __str__(self):
        return f"{self.scene_id} -> {self.target_scene_id}"

    def clean(self):
        super().clean()

        errors = {}

        if self.scene_id and self.target_scene_id and self.scene_id == self.target_scene_id:
            errors["target_scene"] = "صحنه مقصد نمی‌تواند همان صحنه مبدأ باشد."

        if (
            self.scene_id
            and self.target_scene_id
            and self.scene.door_key
            and self.target_scene.door_key
            and self.scene.door_key != self.target_scene.door_key
        ):
            errors["target_scene"] = "نقطه اتصال فقط می‌تواند به صحنه‌ای در همان تور (همان در) وصل شود."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
