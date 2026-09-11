"""Rate-limit identity helpers for requests arriving through the Next BFF.

The browser cannot safely expose its network address to the Django service:
the BFF is the TCP peer for every request.  A short-lived, signed identity
issued by the BFF gives each browser its own bucket without trusting a
client-supplied forwarded header.  Direct callers and deployments that have
not configured the shared secret continue to use DRF's normal peer address.
"""

import hashlib
import hmac

from django.conf import settings
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle


def _signed_bff_identity(request):
    token = request.META.get("HTTP_X_BESAT_ANONYMOUS_ID", "")
    secret = getattr(settings, "BESAT_ANON_THROTTLE_SECRET", "")
    if not token or not secret or token.count(".") != 1:
        return None

    identity, signature = token.split(".", 1)
    if len(identity) < 16 or len(identity) > 128 or not signature:
        return None
    expected = hmac.new(
        secret.encode("utf-8"), identity.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None
    return f"bff:{identity}"


class BFFIdentityThrottleMixin:
    """Use the verified BFF identity, never an arbitrary client header."""

    def get_ident(self, request):
        return _signed_bff_identity(request) or super().get_ident(request)


class BFFAnonRateThrottle(BFFIdentityThrottleMixin, AnonRateThrottle):
    """Anonymous/public-read throttle with per-browser BFF buckets."""


class BFFScopedRateThrottle(BFFIdentityThrottleMixin, ScopedRateThrottle):
    """Scoped login/write throttle with the same safe identity resolution."""

