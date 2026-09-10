"""Minimal, real, testable alert-firing -- the seed of Phase 13 (real
alerting), not the full system. See docs/reliability/ALERTING.md for what
this deliberately is and is not.

No Alertmanager/PagerDuty/Slack integration exists yet (adding one is a
concrete infrastructure decision, not something to invent unilaterally
here). What this module guarantees today: firing an alert ALWAYS produces
a real, structured, high-severity log line (so it's visible in
`docs/reliability/OBSERVABILITY.md`'s logging pipeline the moment that
pipeline is actually watched by something), and ADDITIONALLY sends a real
email via Django's already-configured EMAIL_BACKEND when
ALERT_RECIPIENT_EMAIL is set -- console backend in dev (visible in
container logs), a real backend once one is configured for production.
"""

import logging
import time

from django.conf import settings
from django.core.mail import send_mail

alert_logger = logging.getLogger("besat.alert")

# Per-alert-name cooldown -- readiness_check (public, could be polled by a
# load balancer every few seconds) and deep_health_check both ultimately
# call the same DB probe; without this, a sustained DB outage would fire
# (and email) an alert on every single poll. This is a deliberately simple
# in-process cooldown, not real deduplication/grouping (that needs a
# shared store once multiple app instances exist -- see FAILURE_MATRIX.md's
# existing note on LocMemCache not being shared across gunicorn workers,
# which applies here too) -- documented as a known limitation, not hidden.
_DEFAULT_COOLDOWN_SECONDS = 300
_last_fired: dict[str, float] = {}


def fire_alert(name: str, severity: str, detail: str, *, cooldown_seconds: int = _DEFAULT_COOLDOWN_SECONDS) -> bool:
    """Fire one alert. `name` should match one of the brief's named alert
    types (SITE DOWN, DB DOWN, HIGH_5XX, etc.) so a future Alertmanager
    rule set can key off it directly without a rename. `severity` is
    "critical" or "warning" per the brief's own two tiers.

    Returns True if the alert was actually fired, False if it was
    suppressed by the cooldown -- callers/tests can assert on this
    directly rather than needing to inspect logs to know what happened.
    """
    now = time.monotonic()
    last = _last_fired.get(name)
    if last is not None and (now - last) < cooldown_seconds:
        return False
    _last_fired[name] = now

    log_method = alert_logger.critical if severity == "critical" else alert_logger.warning
    log_method(
        "alert_fired",
        extra={"alert_name": name, "severity": severity, "detail": detail},
    )

    recipient = getattr(settings, "ALERT_RECIPIENT_EMAIL", "")
    if recipient:
        send_mail(
            subject=f"[besat-backend] {severity.upper()}: {name}",
            message=detail,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "besat@localhost"),
            recipient_list=[recipient],
            fail_silently=True,
        )

    return True
