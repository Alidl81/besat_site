# Dashboard app has no database model.
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class Student(TimeStampedModel):
    full_name = models.CharField(max_length=255)
    national_code = models.CharField(max_length=32, null=True, blank=True, db_index=True)
    unit = models.ForeignKey(
        "units.SchoolUnit",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="students",
    )
    class_title = models.CharField(max_length=255, null=True, blank=True)
    parent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children_records",
    )

    class Meta:
        ordering = ("full_name", "id")


class SchoolClass(TimeStampedModel):
    title = models.CharField(max_length=255)
    unit = models.ForeignKey(
        "units.SchoolUnit",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="classes",
    )
    grade = models.CharField(max_length=100, null=True, blank=True)
    capacity = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ("unit_id", "title", "id")


class Program(TimeStampedModel):
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    unit = models.ForeignKey(
        "units.SchoolUnit",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="programs",
    )
    date = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        ordering = ("-created_at", "-id")


class InternalMessage(TimeStampedModel):
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_internal_messages",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_internal_messages",
    )
    sender_name = models.CharField(max_length=255)
    sender_role = models.CharField(max_length=30)
    recipient_name = models.CharField(max_length=255)
    recipient_role = models.CharField(max_length=30, null=True, blank=True)
    subject = models.CharField(max_length=255)
    body = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    unit = models.ForeignKey(
        "units.SchoolUnit",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="internal_messages",
    )

    class Meta:
        ordering = ("-created_at", "-id")
