from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class ContentRevision(TimeStampedModel):
    class Kind(models.TextChoices):
        NEWS = "news", "خبر"
        ANNOUNCEMENT = "announcement", "اطلاعیه"

    content_kind = models.CharField(max_length=20, choices=Kind.choices)
    object_id = models.PositiveBigIntegerField()
    snapshot = models.JSONField()
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="content_revisions",
    )
    note = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(fields=("content_kind", "object_id", "-created_at")),
        ]

    def __str__(self):
        return f"{self.content_kind}-{self.object_id} @ {self.created_at:%Y-%m-%d %H:%M}"
