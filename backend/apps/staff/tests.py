import shutil
import tempfile
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.departments.models import Department
from apps.units.models import SchoolUnit

from apps.staff.models import StaffMember


User = get_user_model()
TEMP_MEDIA_ROOT = tempfile.mkdtemp()


def make_test_image(name="staff.webp", image_format="WEBP", content_type="image/webp"):
    image_file = BytesIO()
    image = Image.new("RGB", (100, 100), color="white")
    image.save(image_file, image_format)
    image_file.seek(0)

    return SimpleUploadedFile(
        name=name,
        content=image_file.read(),
        content_type=content_type,
    )


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class StaffPublicAPITests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()

        self.unit = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            is_active=True,
        )

        self.department = Department.objects.create(
            title="دپارتمان آموزشی",
            slug="education",
            is_active=True,
        )

    def create_staff_member(
        self,
        full_name="عضو کادر تست",
        slug="test-staff",
        scope=None,
        unit=None,
        department=None,
        is_active=True,
        is_featured=False,
        staff_type=None,
    ):
        if scope is None:
            scope = StaffMember.Scope.SCHOOL

        if staff_type is None:
            staff_type = StaffMember.StaffType.TEACHER

        return StaffMember.objects.create(
            full_name=full_name,
            slug=slug,
            staff_type=staff_type,
            role_title="معلم",
            bio="معرفی کوتاه",
            avatar=make_test_image(name=f"{slug}.webp"),
            scope=scope,
            unit=unit,
            department=department,
            is_active=is_active,
            is_featured=is_featured,
            order=1,
        )

    def test_staff_list_returns_only_active_members(self):
        active_staff = self.create_staff_member(
            full_name="عضو فعال",
            slug="active-staff",
        )

        self.create_staff_member(
            full_name="عضو غیرفعال",
            slug="inactive-staff",
            is_active=False,
        )

        response = self.client.get("/api/staff/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], active_staff.id)
        self.assertIn("avatar", response.data["results"][0])
        self.assertIn("image", response.data["results"][0])

    def test_staff_detail_by_slug(self):
        self.create_staff_member(
            full_name="عضو جزئیات",
            slug="detail-staff",
        )

        response = self.client.get("/api/staff/detail-staff/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["full_name"], "عضو جزئیات")

    def test_inactive_staff_detail_returns_404(self):
        self.create_staff_member(
            full_name="عضو غیرفعال",
            slug="inactive-detail-staff",
            is_active=False,
        )

        response = self.client.get("/api/staff/inactive-detail-staff/")

        self.assertEqual(response.status_code, 404)

    def test_filter_unit_staff(self):
        self.create_staff_member(
            full_name="عضو واحد",
            slug="unit-staff",
            scope=StaffMember.Scope.UNIT,
            unit=self.unit,
        )

        self.create_staff_member(
            full_name="عضو مدرسه",
            slug="school-staff",
            scope=StaffMember.Scope.SCHOOL,
            unit=None,
        )

        response = self.client.get(f"/api/staff/?unit_id={self.unit.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["unit_id"], self.unit.id)

    def test_filter_department_staff(self):
        self.create_staff_member(
            full_name="عضو دپارتمان",
            slug="department-staff",
            department=self.department,
        )

        response = self.client.get(f"/api/staff/?department_id={self.department.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["department_id"], self.department.id)

    def test_filter_featured_staff(self):
        self.create_staff_member(
            full_name="عضو ویژه",
            slug="featured-staff",
            is_featured=True,
        )

        self.create_staff_member(
            full_name="عضو معمولی",
            slug="normal-staff",
            is_featured=False,
        )

        response = self.client.get("/api/staff/?featured=true")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["slug"], "featured-staff")


class StaffModelValidationTests(TestCase):
    def setUp(self):
        self.unit = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            is_active=True,
        )

    def test_unit_scope_requires_unit(self):
        staff = StaffMember(
            full_name="عضو واحدی",
            scope=StaffMember.Scope.UNIT,
        )

        with self.assertRaises(ValidationError):
            staff.full_clean()

    def test_school_scope_must_not_have_unit(self):
        staff = StaffMember(
            full_name="عضو مدرسه‌ای",
            scope=StaffMember.Scope.SCHOOL,
            unit=self.unit,
        )

        with self.assertRaises(ValidationError):
            staff.full_clean()


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class StaffCMSAPITests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()

        self.unit = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            is_active=True,
        )

        self.department = Department.objects.create(
            title="دپارتمان آموزشی",
            slug="education",
            is_active=True,
        )

        self.general_manager = self.create_user(
            username="general",
            role=UserProfile.Role.GENERAL_MANAGER,
        )
        self.unit_manager = self.create_user(
            username="unitmanager",
            role=UserProfile.Role.UNIT_MANAGER,
        )
        self.parent = self.create_user(
            username="parent",
            role=UserProfile.Role.PARENT,
        )

        UserUnitMembership.objects.create(
            user=self.unit_manager,
            unit=self.unit,
            role=UserUnitMembership.UnitRole.UNIT_MANAGER,
            is_active=True,
        )

        self.staff_member = StaffMember.objects.create(
            full_name="عضو CMS",
            slug="cms-staff",
            staff_type=StaffMember.StaffType.TEACHER,
            role_title="معلم",
            bio="معرفی",
            avatar=make_test_image("cms-staff.webp"),
            scope=StaffMember.Scope.UNIT,
            unit=self.unit,
            department=self.department,
            is_active=True,
            is_featured=True,
        )

    def create_user(self, username, role):
        user = User.objects.create_user(
            username=username,
            password="password123",
            email=f"{username}@example.com",
        )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.is_active = True
        profile.save()

        return user

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_general_manager_can_list_staff(self):
        self.authenticate(self.general_manager)

        response = self.client.get("/api/cms/staff/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

    def test_unit_manager_can_list_own_unit_staff(self):
        self.authenticate(self.unit_manager)

        response = self.client.get("/api/cms/staff/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.staff_member.id)

    def test_parent_cannot_list_staff(self):
        self.authenticate(self.parent)

        response = self.client.get("/api/cms/staff/")

        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_list_staff(self):
        response = self.client.get("/api/cms/staff/")

        self.assertEqual(response.status_code, 401)

    def test_general_manager_can_create_school_staff(self):
        self.authenticate(self.general_manager)

        payload = {
            "full_name": "مدیر مدرسه",
            "staff_type": StaffMember.StaffType.MANAGER,
            "role_title": "مدیر مدرسه",
            "bio": "معرفی مدیر",
            "scope": StaffMember.Scope.SCHOOL,
            "department": self.department.id,
            "is_active": True,
            "is_featured": True,
            "order": 1,
            "avatar": make_test_image("manager.webp"),
        }

        response = self.client.post(
            "/api/cms/staff/",
            payload,
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(StaffMember.objects.count(), 2)

    def test_unit_manager_can_create_own_unit_staff(self):
        self.authenticate(self.unit_manager)

        payload = {
            "full_name": "معلم واحد",
            "staff_type": StaffMember.StaffType.TEACHER,
            "role_title": "معلم پایه اول",
            "bio": "معرفی معلم",
            "scope": StaffMember.Scope.UNIT,
            "unit": self.unit.id,
            "department": self.department.id,
            "is_active": True,
            "is_featured": False,
            "order": 2,
            "avatar": make_test_image("unit-teacher.webp"),
        }

        response = self.client.post(
            "/api/cms/staff/",
            payload,
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(StaffMember.objects.count(), 2)

    def test_unit_manager_cannot_create_school_staff(self):
        self.authenticate(self.unit_manager)

        payload = {
            "full_name": "عضو مدرسه‌ای غیرمجاز",
            "staff_type": StaffMember.StaffType.TEACHER,
            "scope": StaffMember.Scope.SCHOOL,
            "is_active": True,
        }

        response = self.client.post(
            "/api/cms/staff/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_general_manager_can_update_staff(self):
        self.authenticate(self.general_manager)

        response = self.client.patch(
            f"/api/cms/staff/{self.staff_member.id}/",
            {
                "role_title": "عنوان ویرایش‌شده",
                "is_featured": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.staff_member.refresh_from_db()
        self.assertEqual(self.staff_member.role_title, "عنوان ویرایش‌شده")
        self.assertFalse(self.staff_member.is_featured)

    def test_general_manager_can_delete_staff(self):
        self.authenticate(self.general_manager)

        response = self.client.delete(f"/api/cms/staff/{self.staff_member.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertEqual(StaffMember.objects.count(), 0)