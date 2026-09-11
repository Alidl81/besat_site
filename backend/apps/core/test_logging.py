"""Tests for the redaction and structured-logging utilities in
apps.core.logging_utils -- part of the observability foundation, see
docs/BACKEND.md
(the "never log" field list these tests enforce).
"""

import json
import logging
from datetime import datetime

from django.test import TestCase

from apps.core.logging_utils import JSONFormatter, redact, redact_headers


class RedactionTests(TestCase):
    def test_redacts_password_field(self):
        result = redact({"username": "ali", "password": "hunter2"})

        self.assertEqual(result["username"], "ali")
        self.assertEqual(result["password"], "[REDACTED]")

    def test_redacts_every_field_on_the_brief_s_never_log_list(self):
        payload = {
            "password": "x",
            "authorization": "Bearer abc.def.ghi",
            "cookie": "sessionid=abc123",
            "access_token": "eyJ...",
            "refresh_token": "eyJ...",
            "session_id": "abc123",
            "invite_token": "xyz",
            "api_key": "sk-live-abc",
            "national_code": "0012345678",
        }

        result = redact(payload)

        for key in payload:
            self.assertEqual(
                result[key],
                "[REDACTED]",
                f"{key!r} should have been redacted and was not",
            )

    def test_does_not_redact_ordinary_fields(self):
        result = redact({"title": "خبر امروز", "status": "published", "id": 42})

        self.assertEqual(result, {"title": "خبر امروز", "status": "published", "id": 42})

    def test_redacts_sensitive_keys_at_any_nesting_depth(self):
        payload = {
            "user": {
                "profile": {
                    "password": "hunter2",
                    "name": "ali",
                },
            },
            "items": [
                {"card_number": "4111111111111111", "amount": 100},
            ],
        }

        result = redact(payload)

        self.assertEqual(result["user"]["profile"]["password"], "[REDACTED]")
        self.assertEqual(result["user"]["profile"]["name"], "ali")
        self.assertEqual(result["items"][0]["card_number"], "[REDACTED]")
        self.assertEqual(result["items"][0]["amount"], 100)

    def test_redact_headers_catches_the_authorization_header(self):
        result = redact_headers({"Authorization": "Bearer secret.jwt.here", "Content-Type": "application/json"})

        self.assertEqual(result["Authorization"], "[REDACTED]")
        self.assertEqual(result["Content-Type"], "application/json")

    def test_redact_is_bounded_against_pathological_depth(self):
        # Build a deeply nested structure and confirm redact() terminates
        # rather than recursing until it blows the stack.
        payload = {"password": "x"}
        for _ in range(50):
            payload = {"nested": payload}

        result = redact(payload)  # must return, not raise/hang

        self.assertIsInstance(result, dict)


class JSONFormatterTests(TestCase):
    def _format(self, extra=None, level=logging.INFO, msg="test message"):
        record = logging.LogRecord(
            name="besat.request",
            level=level,
            pathname=__file__,
            lineno=1,
            msg=msg,
            args=(),
            exc_info=None,
        )
        if extra:
            for key, value in extra.items():
                setattr(record, key, value)
        return json.loads(JSONFormatter().format(record))

    def test_produces_valid_json_with_required_fields(self):
        payload = self._format(extra={"request_id": "abc-123", "route": "/api/health/", "method": "GET", "status_code": 200, "duration_ms": 4.2})

        for field in ("timestamp", "level", "service", "environment", "logger", "message"):
            self.assertIn(field, payload, f"required field {field!r} missing from log payload")

        self.assertEqual(payload["request_id"], "abc-123")
        self.assertEqual(payload["route"], "/api/health/")
        self.assertEqual(payload["status_code"], 200)

    def test_extra_fields_are_redacted(self):
        """Proves the formatter itself redacts, not just the middleware
        that happens to only pass safe fields today -- any future
        logger.info(..., extra={"password": ...}) call anywhere in the
        codebase is still caught here.
        """
        payload = self._format(extra={"password": "hunter2", "safe_field": "ok"})

        self.assertEqual(payload["password"], "[REDACTED]")
        self.assertEqual(payload["safe_field"], "ok")

    def test_service_and_level_are_always_present(self):
        payload = self._format(level=logging.ERROR)

        self.assertEqual(payload["service"], "besat-backend")
        self.assertEqual(payload["level"], "ERROR")

    def test_timestamp_has_real_microseconds_not_a_literal_percent_f(self):
        """Regression test: logging.Formatter.formatTime() delegates to
        time.strftime(), which does not understand "%f" -- an earlier
        version of this formatter passed the literal unresolved string
        "%f" straight into every timestamp. Asserts both that the literal
        is gone and that a real, parseable timestamp is produced.
        """
        payload = self._format()

        self.assertNotIn("%f", payload["timestamp"])
        parsed = datetime.strptime(payload["timestamp"], "%Y-%m-%dT%H:%M:%S.%fZ")
        self.assertIsInstance(parsed, datetime)
