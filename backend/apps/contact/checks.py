from django.conf import settings
from django.core.checks import Error, Tags, register
from django.db import OperationalError, ProgrammingError


@register(Tags.models)
def production_contact_info_check(app_configs, **kwargs):
    """Fail a production check before an empty public contact surface ships.

    Values remain editorial data, not source constants. Development and test
    databases intentionally start empty, while the production release gate
    requires an active record with at least one actionable channel.
    """
    if settings.DEBUG or getattr(settings, "TESTING", False):
        return []

    try:
        from .models import ContactInfo

        contact = ContactInfo.objects.filter(is_active=True).first()
    except (OperationalError, ProgrammingError):
        # Migration/bootstrap checks must report their own database problem;
        # don't hide it behind a misleading content-data error.
        return []

    if contact is None:
        return [
            Error(
                "An active ContactInfo record is required for production.",
                hint="Publish approved phone, email, address, or map data before release.",
                id="besat.E001",
            )
        ]

    if not any((contact.phone, contact.phone_secondary, contact.email, contact.address, contact.map_url)):
        return [
            Error(
                "The active ContactInfo record has no actionable channel.",
                hint="Populate an approved phone, email, address, or map URL before release.",
                id="besat.E002",
            )
        ]
    return []
