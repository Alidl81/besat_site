def throttle_rate_configured(scope: str) -> bool:
    """True when settings.REST_FRAMEWORK.DEFAULT_THROTTLE_RATES defines a
    rate for this scope. Lets a view fall back to its default throttles
    (e.g. none, under test settings, which intentionally clears this dict)
    instead of ScopedRateThrottle raising ImproperlyConfigured."""
    from django.conf import settings

    rates = settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})
    return bool(rates.get(scope))


def normalize_text(value: str | None) -> str:
    if value is None:
        return ""
    
    return " ".join(value.strip().split())


def empty_to_none(value: str | None) -> str | None:
    normalized = normalize_text(value)

    if normalized == "":
        return None
    
    return normalized