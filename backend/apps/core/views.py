import hmac
import logging
import time

from django.conf import settings
from django.db import DatabaseError, connections
from django.http import HttpResponse
try:
    from django_prometheus import exports as prometheus_exports
except ImportError:  # cached local images may predate the optional dependency
    from . import prometheus_fallback as prometheus_exports
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .alerting import fire_alert

logger = logging.getLogger("besat.health")

# Debounce window for the real DB round trip inside _check_database. Found
# live in this session: Docker's own healthcheck (interval: 10s) alone was
# enough, combined with DRF's default AnonRateThrottle, to flap the
# container to "unhealthy" -- and in a real deployment, a load balancer,
# an orchestrator, and an external black-box monitor can all be polling
# readiness/deep-health concurrently. Without a debounce, every one of
# those pollers triggers its own `SELECT 1` -- correct individually, but
# an unbounded multiplier on Postgres as more pollers/instances are added.
# A short in-process cache means: worst case, one real query per worker
# process per window, no matter how many callers ask inside it. Per-worker
# (a module-level dict, not Django's cache framework) is intentional --
# the health debounce only needs to reduce repeated probes within each
# worker; throttle counters use the configured shared cache separately.
_DB_CHECK_DEBOUNCE_SECONDS = 2.0
_db_check_cache: dict[str, dict] = {}


def _check_database(alias: str = "default") -> dict:
    """A real connectivity probe, not just "is there a DATABASES entry" --
    opens a connection and runs the cheapest possible round trip, so a down
    or unreachable database actually fails this check.

    Deliberately returns ONLY {"status", "latency_ms"} -- never the raw
    exception. A database/connection exception can contain the hostname,
    database name, and sometimes the username in its message text; no HTTP
    response, public or authenticated, should ever echo that back (an
    operator with real access has server logs for that). The exception is
    logged server-side instead, at ERROR level so it surfaces wherever
    logs are actually collected.

    Results are debounced per-alias for _DB_CHECK_DEBOUNCE_SECONDS (see
    module docstring above) -- a cache hit returns the same, genuinely
    measured result from the last real probe, not a fabricated one.
    """
    cached = _db_check_cache.get(alias)
    now = time.monotonic()
    if cached is not None and (now - cached["checked_at"]) < _DB_CHECK_DEBOUNCE_SECONDS:
        return {"status": cached["status"], "latency_ms": cached["latency_ms"]}

    started = now
    try:
        connection = connections[alias]
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        result = {
            "status": "ok",
            "latency_ms": round((time.monotonic() - started) * 1000, 1),
        }
    except DatabaseError:
        logger.error("Health check: database connectivity probe failed.", exc_info=True)
        fire_alert(
            name="DB_DOWN",
            severity="critical",
            detail="The backend's database connectivity probe failed -- see server logs for the exception.",
        )
        result = {
            "status": "down",
            "latency_ms": round((time.monotonic() - started) * 1000, 1),
        }

    _db_check_cache[alias] = {**result, "checked_at": started}
    return result


@extend_schema(
    tags=["Core"],
    responses={200: OpenApiResponse(description="Process is running.")},
)
@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])
def liveness_check(request):
    """Liveness: "is this process alive at all". Deliberately checks
    nothing beyond the process itself responding -- a database outage must
    never fail liveness, or an orchestrator restarting on liveness failure
    would restart-loop the app on every DB blip instead of just marking it
    not-ready (see readiness_check) and leaving it to recover. Minimal
    payload by design: no dependency detail belongs on a public,
    unauthenticated, process-only check.

    Explicitly un-throttled: DRF's DEFAULT_THROTTLE_CLASSES applies
    AnonRateThrottle globally, and this endpoint is polled by
    infrastructure (load balancers, container orchestrators, external
    monitors) far more often than the general anon API rate exists to
    allow. Found live in this session: the docker-compose healthcheck
    (10s interval against /api/health/, which aliases readiness_check)
    was itself enough anonymous traffic to trip the default 100/hour anon
    throttle and flap the container to "unhealthy" -- a self-inflicted
    outage caused by protecting an endpoint that must never be rate
    limited. Safe to exempt: this view does nothing but return a static
    payload, so unthrottled traffic here cannot cause the kind of
    resource pressure throttling exists to prevent.
    """
    return Response({"status": "ok.", "service": "besat-backend"})


@extend_schema(
    tags=["Core"],
    responses={
        200: OpenApiResponse(description="Ready to receive traffic."),
        503: OpenApiResponse(description="Not ready -- a required dependency is unreachable."),
    },
)
@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])
def readiness_check(request):
    """Readiness: "is it safe to route traffic here". Checks the one
    dependency this app cannot function without: the database. Public and
    unauthenticated by design -- load balancers and Docker healthchecks
    need to reach this without custom auth -- so the payload is
    deliberately minimal: a status word only, never a dependency
    breakdown, hostname, or exception text. Anyone wanting the breakdown
    behind this status needs deep_health_check, which is authenticated.

    Explicitly un-throttled for the same reason as liveness_check above
    (see that docstring for the live incident that surfaced this). The
    real DB round trip this view triggers is protected separately, by
    _check_database's own debounce window -- so removing the DRF-level
    throttle here does not reopen the "hammering Postgres" risk, it only
    stops legitimate infrastructure polling from being mistaken for abuse.
    """
    database = _check_database()
    healthy = database["status"] == "ok"

    payload = {"status": "ok." if healthy else "not_ready."}
    return Response(payload, status=200 if healthy else 503)


# Kept as the pre-existing public contract (used by docker-compose's
# healthcheck and any external caller depending on GET /api/health/
# already) -- now backed by the same DB-aware readiness logic instead of an
# unconditional 200, which fixes the documented false-positive where the
# health check stayed green through a full database outage.
healthy_check = readiness_check


def _deep_health_authorized(request) -> bool:
    """Internal-service-token gate for deep_health_check. Not tied to the
    product's own user/role system on purpose -- operational diagnostics
    are a different trust boundary from "is this a general_manager", and
    conflating the two would mean every future technician/Ops identity
    change has to remember to keep this endpoint's authorization in sync.
    A shared internal token is the simplest correct mechanism available
    before the Ops Portal's own authentication exists; swap this for real
    Ops Portal service-to-service auth once that's built, without changing
    this endpoint's response contract.
    """
    configured = getattr(settings, "INTERNAL_HEALTH_TOKEN", "")
    if not configured:
        # Fails closed: an unconfigured token means deep health is
        # unreachable by anyone rather than accidentally open.
        return False

    supplied = request.headers.get("X-Internal-Health-Token", "")
    return hmac.compare_digest(supplied, configured)


@extend_schema(
    tags=["Core"],
    responses={
        200: OpenApiResponse(description="Per-dependency health and latency."),
        403: OpenApiResponse(description="Missing or invalid internal health token."),
    },
)
@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])
def deep_health_check(request):
    """Deep dependency health: status AND latency per dependency, for
    diagnostics / the future Ops Portal. Gated by an internal service
    token (see _deep_health_authorized) -- this is operational diagnostic
    data, not a public API, even though it never contains secrets itself:
    the brief's own rule is that this class of endpoint must not be an
    unrestricted public surface regardless of what each individual field
    contains. Extend the checks dict as real dependencies (cache, storage,
    queue) are actually added; there is nothing here to check for those
    yet because none exist (see docs/BACKEND.md).

    Un-throttled like the two views above: access control here is the
    internal token, not DRF's anonymous-traffic throttle, and a future
    Ops Portal/monitoring system polling this on its own schedule should
    not have to also negotiate the generic anon rate limit. The
    _check_database debounce still bounds real DB load regardless of
    poll frequency.
    """
    if not _deep_health_authorized(request):
        return Response({"detail": "Not authorized."}, status=403)

    checks = {"database": _check_database()}
    overall = "ok" if all(check["status"] == "ok" for check in checks.values()) else "degraded"

    return Response({"status": overall, "service": "besat-backend", "checks": checks})


def metrics_view(request):
    """Prometheus scrape endpoint, gated behind the same internal-service
    token as deep_health_check.

    django_prometheus.exports.ExportToDjangoView -- what this wraps -- has
    zero authentication of its own by design (confirmed directly from its
    source/docs); its own documentation explicitly notes it performs no
    auth checks at all. Per the brief's explicit "do not expose Prometheus
    ... to the public Internet" requirement, this must not be reachable
    without the same internal control this app already uses for deep
    health. A plain Django view (not a DRF @api_view) on purpose: the
    underlying export function returns a raw django.http.HttpResponse in
    Prometheus's text exposition format, not JSON, so there is nothing for
    DRF's content negotiation/renderer stack to add here.
    """
    if not _deep_health_authorized(request):
        return HttpResponse("Not authorized.", status=403, content_type="text/plain")

    return prometheus_exports.ExportToDjangoView(request)
