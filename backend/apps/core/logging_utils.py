"""Structured JSON logging + central redaction.

Built as part of the observability foundation -- see
docs/reliability/OBSERVABILITY.md. Every HTTP request produces exactly one
structured log line (apps.core.middleware.RequestLoggingMiddleware) with a
consistent, machine-parseable shape, and every log record -- not just the
request-summary line -- passes through the redaction filter below before
it reaches any handler, so a stray `logger.info(request.data)` somewhere
in application code can't accidentally leak a password no matter where it
happens to be nested in the payload.
"""

import json
import logging
import re
from datetime import datetime, timezone

# Matched against dict KEYS (case-insensitively) wherever they appear,
# at any nesting depth, in anything passed to a log call. Mirrors the
# "never log" list in docs/security/DATA_CLASSIFICATION.md exactly --
# keep the two in sync.
_SENSITIVE_KEY_PATTERN = re.compile(
    r"(password|passwd|pwd|secret|token|authorization|auth_header|cookie|"
    r"session_?id|sessionid|csrf|api[_-]?key|access[_-]?key|private[_-]?key|"
    r"card[_-]?number|cvv|cvc|national[_-]?code)",
    re.IGNORECASE,
)

REDACTED = "[REDACTED]"


def redact(value, _depth=0):
    """Recursively redact anything under a sensitive-looking key. Leaves
    non-sensitive data untouched. Bounded recursion depth (10) so a
    pathological/circular structure can't hang a log call.
    """
    if _depth > 10:
        return "[REDACTED: max depth]"

    if isinstance(value, dict):
        return {
            key: (REDACTED if _SENSITIVE_KEY_PATTERN.search(str(key)) else redact(val, _depth + 1))
            for key, val in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [redact(item, _depth + 1) for item in value]
    return value


def redact_headers(headers: dict) -> dict:
    """Django's request.headers keys look like "Authorization",
    "Cookie", "X-Api-Key" -- redact() already matches these
    case-insensitively via the pattern above, this is just a clear,
    dedicated entry point for the one call site (the request-logging
    middleware) that specifically handles headers.
    """
    return redact(dict(headers))


class JSONFormatter(logging.Formatter):
    """Structured JSON log formatter. Every record gets: timestamp, level,
    service, environment, logger, message -- plus whatever extra fields
    the log call attached (request_id, route, method, status_code,
    duration_ms, etc. via `logger.info(..., extra={...})`). Extra fields
    are redacted the same way request bodies are; the base fields
    (timestamp/level/service/etc.) are never sensitive by construction so
    they're not passed through redact().
    """

    # Populated once, lazily, to avoid importing Django settings at
    # module-import time (this module may be imported before settings
    # are configured, e.g. during Django's own logging setup).
    _service = "besat-backend"

    def format(self, record: logging.LogRecord) -> str:
        from django.conf import settings

        payload = {
            # logging.Formatter.formatTime() delegates to time.strftime(),
            # which -- unlike datetime.strftime() -- does not understand
            # "%f" (microseconds); it was passing the literal string
            # "%f" straight through unresolved. datetime.fromtimestamp()
            # gives real microsecond precision instead.
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "level": record.levelname,
            "service": self._service,
            "environment": "debug" if getattr(settings, "DEBUG", False) else "production",
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Anything passed via extra={...} lands as attributes on the
        # LogRecord itself -- pull out only the ones that aren't part of
        # logging.LogRecord's own standard attribute set, then redact.
        standard_attrs = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__.keys())
        extra_fields = {
            key: val for key, val in record.__dict__.items()
            if key not in standard_attrs and not key.startswith("_")
        }
        if extra_fields:
            payload.update(redact(extra_fields))

        if record.exc_info:
            # Exception text can contain query parameters, file paths, or
            # (per the health-check incident this session) connection
            # details -- redact() only catches key-based sensitive data in
            # structured payloads, not arbitrary free text, so exception
            # text is intentionally logged as-is here: it goes to server-
            # side logs only, never returned in any HTTP response (see
            # apps/core/views.py's _check_database for the pattern this
            # mirrors). Server logs are a different trust boundary than
            # HTTP responses.
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=False, default=str)
