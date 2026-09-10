"""Tests for apps.core.alerting -- the "first tested alert" required by
this session's checkpoint. See docs/reliability/ALERTING.md.
"""

from unittest.mock import patch

from django.core import mail
from django.test import TestCase, override_settings

from apps.core.alerting import fire_alert
from apps.core.tests import _raise_db_error


class FireAlertTests(TestCase):
    def test_fires_and_logs_a_structured_critical_record(self):
        with self.assertLogs("besat.alert", level="CRITICAL") as captured:
            fired = fire_alert(name="TEST_ALERT", severity="critical", detail="something is wrong")

        self.assertTrue(fired)
        self.assertEqual(len(captured.records), 1)
        record = captured.records[0]
        self.assertEqual(record.alert_name, "TEST_ALERT")
        self.assertEqual(record.severity, "critical")

    def test_warning_severity_logs_at_warning_not_critical(self):
        with self.assertLogs("besat.alert", level="WARNING") as captured:
            fire_alert(name="TEST_WARNING", severity="warning", detail="minor issue")

        self.assertEqual(captured.records[0].levelname, "WARNING")

    def test_no_email_sent_when_no_recipient_configured(self):
        mail.outbox = []

        fire_alert(name="TEST_NO_RECIPIENT", severity="critical", detail="x")

        self.assertEqual(len(mail.outbox), 0)

    @override_settings(ALERT_RECIPIENT_EMAIL="ops@example.invalid")
    def test_sends_a_real_email_when_recipient_is_configured(self):
        mail.outbox = []

        fire_alert(name="TEST_WITH_RECIPIENT", severity="critical", detail="db is down")

        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertIn("TEST_WITH_RECIPIENT", sent.subject)
        self.assertIn("db is down", sent.body)
        self.assertEqual(sent.to, ["ops@example.invalid"])

    def test_cooldown_suppresses_repeated_firing(self):
        """Proves the exact "avoid alert fatigue" requirement, not just
        that a cooldown parameter exists: fire the same alert name twice
        in a row and assert the second call is suppressed.
        """
        first = fire_alert(name="TEST_COOLDOWN", severity="warning", detail="x", cooldown_seconds=300)
        second = fire_alert(name="TEST_COOLDOWN", severity="warning", detail="x", cooldown_seconds=300)

        self.assertTrue(first)
        self.assertFalse(second, "second call within the cooldown window should have been suppressed")

    def test_cooldown_does_not_suppress_a_different_alert_name(self):
        fire_alert(name="TEST_COOLDOWN_A", severity="warning", detail="x", cooldown_seconds=300)
        fired_b = fire_alert(name="TEST_COOLDOWN_B", severity="warning", detail="x", cooldown_seconds=300)

        self.assertTrue(fired_b)

    def test_zero_cooldown_allows_immediate_repeat_firing(self):
        first = fire_alert(name="TEST_ZERO_COOLDOWN", severity="warning", detail="x", cooldown_seconds=0)
        second = fire_alert(name="TEST_ZERO_COOLDOWN", severity="warning", detail="x", cooldown_seconds=0)

        self.assertTrue(first)
        self.assertTrue(second)


class DatabaseDownFiresARealAlertTests(TestCase):
    """End-to-end: a real (mocked) database outage, reached through the
    actual health-check code path, genuinely fires a DB_DOWN alert -- not
    just fire_alert() tested in isolation.
    """

    @override_settings(ALERT_RECIPIENT_EMAIL="ops@example.invalid")
    def test_readiness_failure_fires_a_db_down_alert(self):
        from apps.core.alerting import _last_fired

        _last_fired.pop("DB_DOWN", None)  # isolate from other tests' cooldown state
        mail.outbox = []

        with patch("apps.core.views.connections") as mock_connections:
            mock_connections.__getitem__.return_value.cursor.side_effect = _raise_db_error
            with self.assertLogs("besat.alert", level="CRITICAL") as captured:
                response = self.client.get("/api/health/ready/")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(captured.records[0].alert_name, "DB_DOWN")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("DB_DOWN", mail.outbox[0].subject)
