from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient


class CoreAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_health_check_returns_ok(self):
        response = self.client.get("/api/health/")
    
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "ok.")
        self.assertEqual(response.data["service"], "besat-backend")

    def test_chema_endpoint_is_available(self):
        response = self.client.get("/api/schema/")

        self.assertEqual(response.status_code, 200)

    def test_swagger_docs_endpoint_is_available(self):
        response = self.client.get("/api/docs/")

        self.assertEqual(response.status_code, 200)