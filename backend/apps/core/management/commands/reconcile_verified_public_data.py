"""Guarded, idempotent reconciliation of approved public Besat data.

The command is intentionally dry-run by default. It matches existing records
by the active singleton contract or immutable unit slug, never by local
numeric IDs, and refuses to overwrite a non-empty value that differs from the
approved reference. Use ``--apply`` only after the target database backup and
dry-run output have been reviewed.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, models, transaction

from apps.about.models import AboutPage
from apps.contact.models import ContactInfo
from apps.site_settings.models import SiteSettings
from apps.units.models import SchoolUnit


CENTRAL_CONTACT = {
    "address": "مشهد، بلوار معلم، معلم ۶۹، مجتمع آموزشی بعثت",
    "phone": "05138688881",
    "phone_secondary": "05138681999 (داخلی 400)",
    "email": "info@besat.org",
}

SITE_SETTINGS = {
    "school_name": "مجتمع آموزشی بعثت",
    "address": CENTRAL_CONTACT["address"],
    "phone_primary": CENTRAL_CONTACT["phone"],
    "phone_secondary": CENTRAL_CONTACT["phone_secondary"],
    "email": CENTRAL_CONTACT["email"],
    "telegram_url": "https://telegram.me/besatschool",
    "eitaa_url": "https://eitaa.com/besatpr",
    "founded_year": 1370,
}

ABOUT_METADATA = {
    "title": "درباره مجتمع آموزشی بعثت",
    "history": "تأسیس در سال ۱۳۷۰",
    "founders": [
        {"name": "محمدرضا صدیق‌پور"},
        {"name": "سیدجواد اسدیان"},
    ],
}

HIGH_CONFIDENCE_UNITS = {
    "boys-preschool-elementary-1-2": {
        "address": "مشهد، نبش آزادی ۷",
        "phone": "36012090",
    },
    "boys-elementary-5": {
        "address": "مشهد، بین ستاری ۱۳ و ۱۵",
        "phone": "38681999",
    },
    "boys-middle-school-6": {
        "address": "مشهد، معلم ۶۹",
        "phone": "38681999",
    },
    "boys-high-school-7": {
        "address": "مشهد، معلم ۶۹",
        "phone": "38681999",
    },
    "girls-preschool-elementary-8": {
        "address": "مشهد، فارغ‌التحصیلان ۵",
        "phone": "35019059",
    },
    "girls-preschool-elementary-9": {
        "address": "مشهد، ابوذر ۴",
        "phone": "38403998",
    },
    "girls-elementary-10": {
        "address": "مشهد، دندانپزشکان ۱۲",
        "phone": "35094949",
        "phone_secondary": "35029747",
    },
    "girls-elementary-12": {
        "address": "مشهد، بین وکیل‌آباد ۶۳ و ۶۵",
        "phone": "35016549",
    },
    "kindergarten-13": {
        "address": "مشهد، خیابان صدف، صدف ۲، پلاک ۱۸",
        "phone": "05138908122",
    },
}

CONFLICTED_UNITS = {
    "boys-elementary-3": "phone is shorter than a normal Mashhad landline",
    "boys-preschool-elementary-4": "legacy registration conflicts with older reference data",
    "girls-middle-school-11": "legacy registration conflicts with older reference data",
}


@dataclass
class Change:
    model_label: str
    lookup: str
    field: str
    current: Any
    reference: Any
    action: str
    record: models.Model | None = None
    create_model: type[models.Model] | None = None
    create_defaults: dict[str, Any] | None = None


def _missing(value: Any) -> bool:
    return value is None or (
        isinstance(value, (str, list, dict, tuple, set))
        and not value
    ) or (isinstance(value, str) and not value.strip())


class Command(BaseCommand):
    help = "Dry-run or safely apply verified Besat public-data reconciliation."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply only safe field-level fills; default is read-only dry-run.",
        )

    def handle(self, *args, **options):
        if options["apply"]:
            with transaction.atomic():
                changes = self._plan(lock=True)
                applied = self._apply(changes)
        else:
            changes = self._plan(lock=False)
            applied = 0

        self._print_plan(changes)
        mode = "applied" if options["apply"] else "dry-run"
        self.stdout.write(
            self.style.SUCCESS(
                f"Verified public-data reconciliation {mode}: "
                f"{applied} field/record change(s); "
                f"{sum(change.action == 'OWNER_CONFIRMATION_REQUIRED' for change in changes)} "
                "owner confirmation item(s)."
            )
        )

    def _plan(self, *, lock: bool) -> list[Change]:
        changes: list[Change] = []

        if lock and connection.vendor == "postgresql":
            # Prevent two operators from both observing an absent singleton
            # and creating it concurrently. The lock is transaction-scoped.
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_xact_lock(%s)", [918273645])

        contact = self._singleton(
            ContactInfo,
            "ContactInfo",
            changes,
            lock=lock,
            create_defaults={"is_active": True, "title": "تماس با ما", **CENTRAL_CONTACT},
        )
        if contact is not None:
            self._field_changes(changes, "ContactInfo", "active singleton", contact, CENTRAL_CONTACT)

        settings = self._singleton(
            SiteSettings,
            "SiteSettings",
            changes,
            lock=lock,
            create_defaults={"is_active": True, **SITE_SETTINGS},
        )
        if settings is not None:
            self._field_changes(changes, "SiteSettings", "active singleton", settings, SITE_SETTINGS)

        about = self._singleton(
            AboutPage,
            "AboutPage",
            changes,
            lock=lock,
            create_defaults={"is_active": True, **ABOUT_METADATA},
        )
        if about is not None:
            self._field_changes(changes, "AboutPage", "active singleton", about, ABOUT_METADATA)

        for slug, reason in CONFLICTED_UNITS.items():
            unit = SchoolUnit.objects.filter(slug=slug).first()
            changes.append(
                Change(
                    "SchoolUnit",
                    slug,
                    "structured contact",
                    "preserved current value",
                    reason,
                    "OWNER_CONFIRMATION_REQUIRED",
                    record=unit,
                )
            )

        for slug, fields in HIGH_CONFIDENCE_UNITS.items():
            units = SchoolUnit.objects.filter(slug=slug)
            if lock:
                units = units.select_for_update()
            matches = list(units)
            if len(matches) != 1:
                changes.append(
                    Change(
                        "SchoolUnit",
                        slug,
                        "record",
                        f"{len(matches)} records",
                        "exactly one existing public unit",
                        "OWNER_CONFIRMATION_REQUIRED",
                    )
                )
                continue

            unit = matches[0]
            if not unit.is_active or unit.is_internal:
                changes.append(
                    Change(
                        "SchoolUnit",
                        slug,
                        "publication boundary",
                        {"is_active": unit.is_active, "is_internal": unit.is_internal},
                        "active public unit",
                        "OWNER_CONFIRMATION_REQUIRED",
                        record=unit,
                    )
                )
                continue
            self._field_changes(changes, "SchoolUnit", slug, unit, fields)

        return changes

    def _singleton(
        self,
        model: type[models.Model],
        label: str,
        changes: list[Change],
        *,
        lock: bool,
        create_defaults: dict[str, Any],
    ) -> models.Model | None:
        queryset = model.objects.all()
        if lock:
            queryset = queryset.select_for_update()
        active = list(queryset.filter(is_active=True).order_by("-updated_at", "-id"))
        if len(active) > 1:
            raise CommandError(f"{label} has {len(active)} active records; refusing to guess.")
        if active:
            return active[0]

        if queryset.exists():
            changes.append(
                Change(
                    label,
                    "active singleton",
                    "record",
                    "no active record but existing inactive record(s)",
                    "one authoritative active record",
                    "OWNER_CONFIRMATION_REQUIRED",
                )
            )
            return None

        changes.append(
            Change(
                label,
                "active singleton",
                "record",
                "absent",
                create_defaults,
                "FILL_MISSING",
                create_model=model,
                create_defaults=create_defaults,
            )
        )
        return None

    @staticmethod
    def _field_changes(
        changes: list[Change],
        label: str,
        lookup: str,
        record: models.Model,
        fields: dict[str, Any],
    ) -> None:
        for field, reference in fields.items():
            current = getattr(record, field)
            if _missing(current):
                action = "FILL_MISSING"
            elif current == reference:
                action = "KEEP_CURRENT"
            else:
                action = "OWNER_CONFIRMATION_REQUIRED"
            changes.append(Change(label, lookup, field, current, reference, action, record=record))

    @staticmethod
    def _apply(changes: list[Change]) -> int:
        applied = 0
        for change in changes:
            if change.action == "FILL_MISSING" and change.create_model is not None:
                change.create_model.objects.create(**change.create_defaults)
                applied += 1
            elif change.action == "FILL_MISSING" and change.record is not None:
                setattr(change.record, change.field, change.reference)
                change.record.save()
                applied += 1
        return applied

    def _print_plan(self, changes: list[Change]) -> None:
        for change in changes:
            self.stdout.write(
                f"{change.action}\t{change.model_label}\t{change.lookup}\t"
                f"{change.field}\tcurrent={change.current!r}\t"
                f"reference={change.reference!r}"
            )
