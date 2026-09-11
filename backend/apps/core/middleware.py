import logging
import time
import uuid

request_logger = logging.getLogger("besat.request")

REQUEST_ID_HEADER = "X-Request-ID"
# Django turns "X-Request-ID" into this WSGI/META key.
REQUEST_ID_META_KEY = "HTTP_X_REQUEST_ID"


class RequestLoggingMiddleware:
    """One structured log line per request, with a request_id that
    correlates this request across the frontend BFF proxy, this backend,
    and (where applicable) any outgoing dependency call -- see
    docs/BACKEND.md for the full propagation chain.

    Accepts an inbound X-Request-ID (set by the frontend's BFF proxy, see
    frontend/src/app/api/backend/[...path]/route.ts) so a single browser
    request is traceable end-to-end by one ID; generates a fresh UUID4 if
    the header is absent (e.g. a direct API call, or local `curl` testing)
    so every request still gets a stable ID rather than silently having
    none.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.META.get(REQUEST_ID_META_KEY) or str(uuid.uuid4())
        request.request_id = request_id

        started = time.monotonic()
        response = self.get_response(request)
        duration_ms = round((time.monotonic() - started) * 1000, 1)

        response[REQUEST_ID_HEADER] = request_id

        route = None
        if getattr(request, "resolver_match", None) is not None:
            route = request.resolver_match.route

        request_logger.info(
            "request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "route": route,
                "path": request.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "severity": _severity_for_status(response.status_code),
            },
        )

        return response


def _severity_for_status(status_code: int) -> str:
    if status_code >= 500:
        return "error"
    if status_code >= 400:
        return "warning"
    return "info"
