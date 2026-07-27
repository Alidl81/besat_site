from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.departments.models import Department
from apps.home.models import HomeSlide
from apps.news.models import News, NewsCategory
from apps.units.models import SchoolUnit


class SeedPublicDataCommandTests(TestCase):
    def test_command_is_idempotent_and_creates_public_content(self):
        first_output = StringIO()
        call_command("seed_public_data", stdout=first_output)

        expected_counts = {
            SchoolUnit: 12,
            Department: 5,
            HomeSlide: 3,
            NewsCategory: 3,
            News: 4,
        }
        for model, expected_count in expected_counts.items():
            self.assertEqual(model.objects.count(), expected_count)

        second_output = StringIO()
        call_command("seed_public_data", stdout=second_output)

        for model, expected_count in expected_counts.items():
            self.assertEqual(model.objects.count(), expected_count)

        self.assertIn("units=0", second_output.getvalue())
        self.assertIn("news=0", second_output.getvalue())

