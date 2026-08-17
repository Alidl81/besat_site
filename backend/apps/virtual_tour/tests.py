import shutil
import tempfile
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.departments.models import Department
from apps.units.models import SchoolUnit

from .models import TourHotspot, TourScene

User = get_user_model()
TEMP_MEDIA_ROOT = tempfile.mkdtemp()


def make_test_image(name="panorama.webp"):
    buffer = BytesIO()
    Image.new("RGB", (200, 100), color="white").save(buffer, "WEBP")
    buffer.seek(0)
    return SimpleUploadedFile(name=name, content=buffer.read(), content_type="image/webp")


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class VirtualTourBaseTestCase(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()
        self.unit = SchoolUnit.objects.create(title="واحد آزمایشی", slug="unit-a", is_active=True)
        self.department = Department.objects.create(title="دپارتمان آزمایشی", slug="dept-a", is_active=True)

        self.general_manager = self._make_user("gm", UserProfile.Role.GENERAL_MANAGER)
        self.unit_manager = self._make_user("um", UserProfile.Role.UNIT_MANAGER, unit=self.unit, unit_role=UserUnitMembership.UnitRole.UNIT_MANAGER)
        self.unit_media = self._make_user("media", UserProfile.Role.UNIT_MEDIA, unit=self.unit, unit_role=UserUnitMembership.UnitRole.UNIT_MEDIA)
        self.parent = self._make_user("parent", UserProfile.Role.PARENT)

    def _make_user(self, username, role, unit=None, unit_role=None):
        user = User.objects.create_user(username=username, password="x")
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.is_active = True
        profile.save()
        if unit and unit_role:
            UserUnitMembership.objects.create(user=user, unit=unit, role=unit_role, is_active=True)
        return user

    def make_scene(self, **kwargs):
        defaults = {
            "title": "صحنه تست",
            "unit": self.unit,
            "status": TourScene.Status.DRAFT,
        }
        defaults.update(kwargs)
        return TourScene.objects.create(**defaults)


class TourSceneModelTests(VirtualTourBaseTestCase):
    def test_scene_requires_exactly_one_of_unit_or_department(self):
        with self.assertRaises(ValidationError):
            TourScene.objects.create(title="بدون در", unit=None, department=None)
        with self.assertRaises(ValidationError):
            TourScene.objects.create(title="هر دو در", unit=self.unit, department=self.department)

    def test_publishing_requires_panorama_and_published_at(self):
        scene = self.make_scene()
        scene.status = TourScene.Status.PUBLISHED
        with self.assertRaises(ValidationError):
            scene.save()

    def test_only_one_default_scene_per_door(self):
        first = self.make_scene(title="اول", is_default=True)
        second = self.make_scene(title="دوم", is_default=True)
        first.refresh_from_db()
        self.assertFalse(first.is_default)
        self.assertTrue(second.is_default)

    def test_hotspot_cannot_target_itself(self):
        scene = self.make_scene()
        with self.assertRaises(ValidationError):
            TourHotspot.objects.create(scene=scene, target_scene=scene, yaw=0, pitch=0)

    def test_hotspot_cannot_cross_doors(self):
        scene_a = self.make_scene(title="در واحد")
        scene_b = self.make_scene(title="در دپارتمان", unit=None, department=self.department)
        with self.assertRaises(ValidationError):
            TourHotspot.objects.create(scene=scene_a, target_scene=scene_b, yaw=0, pitch=0)


class TourScenePublicAPITests(VirtualTourBaseTestCase):
    def test_public_list_only_returns_published(self):
        self.make_scene(title="پیش‌نویس")
        published = self.make_scene(
            title="منتشرشده",
            status=TourScene.Status.PUBLISHED,
            panorama=make_test_image(),
            published_at=timezone.localdate(),
        )
        response = self.client.get("/api/virtual-tour/scenes/")
        self.assertEqual(response.status_code, 200)
        slugs = [item["slug"] for item in response.data["results"]]
        self.assertEqual(slugs, [published.slug])

    def test_public_filter_by_door(self):
        self.make_scene(
            title="در واحد",
            status=TourScene.Status.PUBLISHED,
            panorama=make_test_image(),
            published_at=timezone.localdate(),
        )
        response = self.client.get(f"/api/virtual-tour/scenes/?door=unit:{self.unit.slug}")
        self.assertEqual(len(response.data["results"]), 1)
        response = self.client.get("/api/virtual-tour/scenes/?door=unit:no-such-unit")
        self.assertEqual(len(response.data["results"]), 0)


class VirtualTourCMSPermissionTests(VirtualTourBaseTestCase):
    """Directly exercises the API as each role to confirm the backend
    rejects forbidden operations -- not just that a frontend button is
    hidden."""

    def test_anonymous_and_parent_can_list_cms_endpoint_but_only_see_published(self):
        # Mirrors HasGalleryCMSPermission's convention exactly: CMS
        # list/retrieve are AllowAny at the permission-class level, but
        # get_queryset() still filters non-privileged callers down to
        # published-only -- the real enforcement is server-side filtering,
        # not a 401/403 on the list action itself.
        self.make_scene(title="پیش‌نویس نباید دیده شود")
        for client_setup in (lambda: None, lambda: self.client.force_authenticate(self.parent)):
            client_setup()
            response = self.client.get("/api/cms/virtual-tour/scenes/")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["count"], 0)

    def test_anonymous_and_parent_cannot_write(self):
        for client_setup in (lambda: None, lambda: self.client.force_authenticate(self.parent)):
            client_setup()
            response = self.client.post(
                "/api/cms/virtual-tour/scenes/",
                {"title": "تلاش غیرمجاز", "unit": self.unit.id},
            )
            self.assertIn(response.status_code, (401, 403))

    def test_unit_media_can_create_draft_scene_for_own_unit(self):
        self.client.force_authenticate(self.unit_media)
        response = self.client.post(
            "/api/cms/virtual-tour/scenes/",
            {"title": "صحنه جدید", "unit": self.unit.id},
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "draft")

    def test_unit_media_cannot_create_scene_for_other_unit(self):
        other_unit = SchoolUnit.objects.create(title="واحد دیگر", slug="unit-b", is_active=True)
        self.client.force_authenticate(self.unit_media)
        response = self.client.post(
            "/api/cms/virtual-tour/scenes/",
            {"title": "صحنه ممنوع", "unit": other_unit.id},
        )
        self.assertEqual(response.status_code, 403)

    def test_unit_media_cannot_create_department_scene(self):
        self.client.force_authenticate(self.unit_media)
        response = self.client.post(
            "/api/cms/virtual-tour/scenes/",
            {"title": "صحنه دپارتمانی", "department": self.department.id},
        )
        self.assertEqual(response.status_code, 403)

    def test_only_general_manager_can_publish(self):
        scene = self.make_scene(
            status=TourScene.Status.APPROVED,
            panorama=make_test_image(),
        )
        self.client.force_authenticate(self.unit_manager)
        response = self.client.post(f"/api/cms/virtual-tour/scenes/{scene.id}/publish/")
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(self.general_manager)
        response = self.client.post(f"/api/cms/virtual-tour/scenes/{scene.id}/publish/")
        self.assertEqual(response.status_code, 200)
        scene.refresh_from_db()
        self.assertEqual(scene.status, TourScene.Status.PUBLISHED)

    def test_unit_media_cannot_approve_own_submission(self):
        scene = self.make_scene(status=TourScene.Status.WAITING_REVIEW)
        self.client.force_authenticate(self.unit_media)
        response = self.client.post(f"/api/cms/virtual-tour/scenes/{scene.id}/approve/")
        self.assertEqual(response.status_code, 403)

    def test_unit_manager_can_approve_own_unit_submission(self):
        scene = self.make_scene(status=TourScene.Status.WAITING_REVIEW)
        self.client.force_authenticate(self.unit_manager)
        response = self.client.post(f"/api/cms/virtual-tour/scenes/{scene.id}/approve/")
        self.assertEqual(response.status_code, 200)
        scene.refresh_from_db()
        self.assertEqual(scene.status, TourScene.Status.APPROVED)

    def test_general_manager_can_delete_any_scene(self):
        scene = self.make_scene(unit=None, department=self.department)
        self.client.force_authenticate(self.general_manager)
        response = self.client.delete(f"/api/cms/virtual-tour/scenes/{scene.id}/")
        self.assertEqual(response.status_code, 204)

    def test_unit_manager_cannot_delete_department_scene(self):
        scene = self.make_scene(unit=None, department=self.department)
        self.client.force_authenticate(self.unit_manager)
        response = self.client.delete(f"/api/cms/virtual-tour/scenes/{scene.id}/")
        self.assertIn(response.status_code, (403, 404))
