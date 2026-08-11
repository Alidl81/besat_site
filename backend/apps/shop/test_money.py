from django.test import SimpleTestCase

from apps.shop import money


class MoneyFormattingTests(SimpleTestCase):
    def test_to_display_amount_converts_using_configured_divisor(self):
        self.assertEqual(money.to_display_amount(1_000), 100)

    def test_to_display_amount_handles_none(self):
        self.assertIsNone(money.to_display_amount(None))

    def test_format_amount_for_display_groups_digits(self):
        self.assertEqual(money.format_amount_for_display(1_234_500), "123,450")

    def test_format_amount_for_display_handles_none(self):
        self.assertIsNone(money.format_amount_for_display(None))

    def test_to_storage_amount_round_trips_with_to_display_amount(self):
        display_amount = 4_500
        storage_amount = money.to_storage_amount(display_amount)
        self.assertEqual(money.to_display_amount(storage_amount), display_amount)

    def test_amounts_are_always_integers(self):
        storage_amount = money.to_storage_amount("100")
        self.assertIsInstance(storage_amount, int)
