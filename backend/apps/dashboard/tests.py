from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.announcements.models import Announcement
from apps.gallery.models import GalleryItem
from apps.news.models import News
from apps.registration.models import RegistrationRequest
from apps.units.models import SchoolUnit

from .models import InternalMessage, PanelService, Program, Student

User = get_user_model()


class DashboardAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.unit_1 = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            is_active=True,
            order=1,
        )

        self.unit_2 = SchoolUnit.objects.create(
            title="متوسطه",
            slug="middle-school",
            is_active=True,
            order=2,
        )

        self.general_manager = self.create_user(
            username="general",
            role=UserProfile.Role.GENERAL_MANAGER,
        )

        self.unit_manager = self.create_user(
            username="unitmanager",
            role=UserProfile.Role.UNIT_MANAGER,
        )

        self.unit_media = self.create_user(
            username="unitmedia",
            role=UserProfile.Role.UNIT_MEDIA,
        )

        self.parent = self.create_user(
            username="parent",
            role=UserProfile.Role.PARENT,
        )

        UserUnitMembership.objects.create(
            user=self.unit_manager,
            unit=self.unit_1,
            role=UserUnitMembership.UnitRole.UNIT_MANAGER,
            is_active=True,
        )

        UserUnitMembership.objects.create(
            user=self.unit_media,
            unit=self.unit_1,
            role=UserUnitMembership.UnitRole.UNIT_MEDIA,
            is_active=True,
        )

        UserUnitMembership.objects.create(
            user=self.parent,
            unit=self.unit_1,
            role=UserUnitMembership.UnitRole.PARENT,
            is_active=True,
        )
        self.student = Student.objects.create(
            full_name="فرزند والد",
            national_code="1234567890",
            unit=self.unit_1,
            class_title="اول الف",
            parent=self.parent,
        )
        Program.objects.create(
            title="برنامه واحد",
            unit=self.unit_1,
            date="2026-08-02T08:00:00Z",
        )

        News.objects.create(
            title="خبر دبستان",
            slug="unit-1-news",
            summary="خلاصه",
            scope=News.Scope.UNIT,
            unit=self.unit_1,
            status=News.Status.WAITING_REVIEW,
            is_active=True,
        )

        News.objects.create(
            title="خبر متوسطه",
            slug="unit-2-news",
            summary="خلاصه",
            scope=News.Scope.UNIT,
            unit=self.unit_2,
            status=News.Status.WAITING_REVIEW,
            is_active=True,
        )

        Announcement.objects.create(
            title="اطلاعیه دبستان",
            slug="unit-1-announcement",
            summary="خلاصه",
            scope=Announcement.Scope.UNIT,
            unit=self.unit_1,
            status=Announcement.Status.DRAFT,
            is_active=True,
        )

        GalleryItem.objects.create(
            title="گالری دبستان",
            slug="unit-1-gallery",
            summary="خلاصه",
            scope=GalleryItem.Scope.UNIT,
            unit=self.unit_1,
            status=GalleryItem.Status.DRAFT,
            is_active=True,
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

    def test_general_manager_can_access_general_dashboard(self):
        self.authenticate(self.general_manager)

        response = self.client.get("/api/dashboard/general-manager/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], UserProfile.Role.GENERAL_MANAGER)
        self.assertEqual(response.data["scope"], "all")
        self.assertIn("stats", response.data)
        self.assertIn("cards", response.data)
        self.assertGreaterEqual(response.data["stats"]["content_total"], 4)

    def test_general_manager_dashboard_reports_real_per_unit_performance(self):
        self.authenticate(self.general_manager)

        response = self.client.get("/api/dashboard/general-manager/")

        self.assertEqual(response.status_code, 200)
        units_by_id = {unit["id"]: unit for unit in response.data["units"]}
        self.assertEqual(units_by_id[self.unit_1.id]["title"], self.unit_1.title)
        self.assertEqual(units_by_id[self.unit_1.id]["students_count"], 1)
        self.assertEqual(units_by_id[self.unit_2.id]["students_count"], 0)
        self.assertTrue(units_by_id[self.unit_1.id]["is_active"])

    def test_panel_context_is_scoped_to_the_authenticated_user(self):
        self.authenticate(self.unit_manager)

        response = self.client.get("/api/dashboard/context/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["selected_unit_id"], self.unit_1.id)
        self.assertEqual(response.data["units"], [
            {"id": self.unit_1.id, "title": self.unit_1.title},
        ])
        self.assertEqual(response.data["children"], [])
        self.assertEqual(response.data["unread_notifications"], 1)

    def test_panel_context_rejects_an_inaccessible_unit(self):
        self.authenticate(self.unit_manager)

        response = self.client.get(
            f"/api/dashboard/context/?unit={self.unit_2.id}"
        )

        self.assertEqual(response.status_code, 403)

    def test_panel_context_requires_authentication(self):
        response = self.client.get("/api/dashboard/context/")

        self.assertEqual(response.status_code, 401)

    def test_parent_cannot_access_general_dashboard(self):
        self.authenticate(self.parent)

        response = self.client.get("/api/dashboard/general-manager/")

        self.assertEqual(response.status_code, 403)

    def test_unit_manager_can_access_own_unit_dashboard(self):
        self.authenticate(self.unit_manager)

        response = self.client.get("/api/dashboard/unit-manager/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], UserProfile.Role.UNIT_MANAGER)
        self.assertEqual(response.data["selected_unit"]["id"], self.unit_1.id)
        self.assertEqual(response.data["stats"]["unit_id"], self.unit_1.id)
        self.assertEqual(response.data["stats"]["news_total"], 1)
        self.assertEqual(response.data["stats"]["announcements_total"], 1)
        self.assertEqual(response.data["stats"]["gallery_total"], 1)

    def test_unit_manager_cannot_access_other_unit_dashboard(self):
        self.authenticate(self.unit_manager)

        response = self.client.get(
            f"/api/dashboard/unit-manager/?unit_id={self.unit_2.id}"
        )

        self.assertEqual(response.status_code, 403)

    def test_unit_media_can_access_media_dashboard(self):
        self.authenticate(self.unit_media)

        response = self.client.get("/api/dashboard/media/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], UserProfile.Role.UNIT_MEDIA)
        self.assertEqual(response.data["selected_unit"]["id"], self.unit_1.id)
        self.assertEqual(response.data["stats"]["gallery_total"], 1)

    def test_unit_media_cannot_access_unit_manager_dashboard(self):
        self.authenticate(self.unit_media)

        response = self.client.get("/api/dashboard/unit-manager/")

        self.assertEqual(response.status_code, 403)

    def test_parent_can_access_parent_dashboard(self):
        self.authenticate(self.parent)

        response = self.client.get("/api/dashboard/parents/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], UserProfile.Role.PARENT)
        self.assertIn("profile", response.data)
        self.assertEqual(response.data["stats"]["accessible_units_count"], 1)

    def test_unit_manager_cannot_access_parent_dashboard(self):
        self.authenticate(self.unit_manager)

        response = self.client.get("/api/dashboard/parents/")

        self.assertEqual(response.status_code, 403)

    def test_panel_services_derives_audience_from_the_authenticated_role(self):
        # AUTH-DASH-SERVICES-001: `audience` used to come straight from the
        # query string, so any authenticated caller could request another
        # role's services (or omit the param, which returned everything).
        # The caller's own role must be what decides this, not the request.
        staff_only = PanelService.objects.create(
            title="پنل مدیریت مالی", url="https://example.com/finance", audiences=["staff"],
        )
        parent_only = PanelService.objects.create(
            title="کارنامه دانش‌آموز", url="https://example.com/report-card", audiences=["parent"],
        )
        unrestricted = PanelService.objects.create(
            title="راهنمای سامانه", url="https://example.com/help", audiences=[],
        )

        self.authenticate(self.parent)
        parent_titles = {row["title"] for row in self.client.get("/api/cms/services/").data}
        self.assertEqual(parent_titles, {parent_only.title, unrestricted.title})

        # A parent forging ?audience=staff must not receive the staff-only
        # service -- the server derives audience itself and ignores this.
        forged_titles = {row["title"] for row in self.client.get("/api/cms/services/?audience=staff").data}
        self.assertEqual(forged_titles, {parent_only.title, unrestricted.title})

        self.authenticate(self.general_manager)
        staff_titles = {row["title"] for row in self.client.get("/api/cms/services/").data}
        self.assertEqual(staff_titles, {staff_only.title, unrestricted.title})

    def test_anonymous_user_cannot_access_dashboard(self):
        response = self.client.get("/api/dashboard/general-manager/")

        self.assertEqual(response.status_code, 401)

    def test_student_summary_is_registered_and_scoped(self):
        self.authenticate(self.general_manager)

        response = self.client.get("/api/cms/students/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 1)
        self.assertEqual(response.data["completed_profiles"], 1)

    def test_parent_records_are_registered_and_scoped_to_the_parent(self):
        self.authenticate(self.parent)

        children = self.client.get("/api/parents/children/")
        detail = self.client.get(f"/api/parents/children/{self.student.id}/")
        programs = self.client.get("/api/parents/programs/")

        self.assertEqual(children.status_code, 200)
        self.assertEqual(children.data[0]["id"], self.student.id)
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["id"], self.student.id)
        self.assertEqual(programs.status_code, 200)
        self.assertEqual(programs.data["count"], 1)

    def test_parent_registrations_are_scoped_by_account_not_contact_details(self):
        owned = RegistrationRequest.objects.create(
            student_full_name="فرزند ثبت‌شده",
            parent_phone="09120000000",
            requested_unit=self.unit_1,
            submitted_by=self.parent,
        )
        RegistrationRequest.objects.create(
            student_full_name="درخواست هم‌نام",
            parent_phone="09120000000",
            requested_unit=self.unit_1,
            submitted_by=self.general_manager,
        )
        self.authenticate(self.parent)

        response = self.client.get("/api/parents/registrations/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [owned.id])

    def test_reports_are_registered_and_require_general_manager(self):
        self.authenticate(self.general_manager)
        allowed = self.client.get("/api/cms/reports/overview/")

        self.authenticate(self.unit_manager)
        denied = self.client.get("/api/cms/reports/overview/")

        self.assertEqual(allowed.status_code, 200)
        self.assertIn("metrics", allowed.data)
        self.assertEqual(denied.status_code, 403)


class InternalMessageAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.unit_1 = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school-msg",
            is_active=True,
            order=1,
        )
        self.unit_2 = SchoolUnit.objects.create(
            title="متوسطه",
            slug="middle-school-msg",
            is_active=True,
            order=2,
        )

        self.general_manager = self.create_user(
            username="msg-general",
            role=UserProfile.Role.GENERAL_MANAGER,
        )
        self.unit_manager_1 = self.create_user(
            username="msg-unitmanager1",
            role=UserProfile.Role.UNIT_MANAGER,
        )
        self.unit_media_1 = self.create_user(
            username="msg-unitmedia1",
            role=UserProfile.Role.UNIT_MEDIA,
        )
        self.unit_manager_2 = self.create_user(
            username="msg-unitmanager2",
            role=UserProfile.Role.UNIT_MANAGER,
        )

        UserUnitMembership.objects.create(
            user=self.unit_manager_1,
            unit=self.unit_1,
            role=UserUnitMembership.UnitRole.UNIT_MANAGER,
            is_active=True,
        )
        UserUnitMembership.objects.create(
            user=self.unit_media_1,
            unit=self.unit_1,
            role=UserUnitMembership.UnitRole.UNIT_MEDIA,
            is_active=True,
        )
        UserUnitMembership.objects.create(
            user=self.unit_manager_2,
            unit=self.unit_2,
            role=UserUnitMembership.UnitRole.UNIT_MANAGER,
            is_active=True,
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
        profile.full_name = username
        profile.save()

        return user

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def send_message(self, recipient):
        return self.client.post(
            "/api/cms/internal-messages/",
            {
                "recipient_id": f"user-{recipient.get_username()}",
                "subject": "موضوع پیام",
                "body": "متن پیام آزمایشی",
            },
            format="json",
        )

    def test_recipients_list_excludes_self_and_out_of_scope_users(self):
        self.authenticate(self.unit_manager_1)

        response = self.client.get("/api/cms/internal-messages/recipients/")

        self.assertEqual(response.status_code, 200)
        recipient_ids = {item["id"] for item in response.data}
        self.assertNotIn(f"user-{self.unit_manager_1.get_username()}", recipient_ids)
        self.assertIn(f"user-{self.unit_media_1.get_username()}", recipient_ids)
        self.assertIn(f"user-{self.general_manager.get_username()}", recipient_ids)
        self.assertNotIn(f"user-{self.unit_manager_2.get_username()}", recipient_ids)

    def test_recipients_list_excludes_a_deactivated_profile(self):
        # AUTH-DASH-MESSAGES-001: get_message_recipient_queryset() only
        # checked User.is_active, not UserProfile.is_active -- a
        # profile-deactivated user (the app-level suspension flag; the
        # underlying Django User row is untouched) was still offered as a
        # selectable message recipient.
        self.unit_media_1.profile.is_active = False
        self.unit_media_1.profile.save()

        self.authenticate(self.unit_manager_1)
        response = self.client.get("/api/cms/internal-messages/recipients/")

        self.assertEqual(response.status_code, 200)
        recipient_ids = {item["id"] for item in response.data}
        self.assertNotIn(f"user-{self.unit_media_1.get_username()}", recipient_ids)

    def test_deactivated_profile_cannot_access_internal_messages(self):
        # Same finding, the other half: a profile-deactivated user must be
        # denied entirely, not just omitted from other users' recipient
        # lists -- permission_classes was plain IsAuthenticated, which
        # only checks the Django User account, never the profile.
        self.unit_manager_1.profile.is_active = False
        self.unit_manager_1.profile.save()

        self.authenticate(self.unit_manager_1)
        response = self.client.get("/api/cms/internal-messages/")

        self.assertEqual(response.status_code, 403)

    def test_create_rejects_self_recipient_even_when_frontend_filter_is_bypassed(self):
        self.authenticate(self.unit_manager_1)

        response = self.send_message(self.unit_manager_1)

        self.assertEqual(response.status_code, 400)

    def broadcast(self, *, unit=None):
        payload = {
            "recipient_role": UserProfile.Role.UNIT_MANAGER,
            "subject": "اطلاعیه",
            "body": "متن اطلاعیه آزمایشی",
        }
        if unit is not None:
            payload["unit_id"] = unit.pk
        return self.client.post("/api/cms/internal-messages/", payload, format="json")

    def test_parent_cannot_broadcast_by_omitting_recipient(self):
        # The compose UI never sends a request without recipient_id -- this
        # is only reachable by calling the API directly (MSG-001).
        parent = self.create_user("msg-parent", UserProfile.Role.PARENT)
        self.authenticate(parent)

        response = self.broadcast(unit=self.unit_1)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(InternalMessage.objects.count(), 0)

    def test_unit_manager_cannot_broadcast_by_omitting_recipient(self):
        self.authenticate(self.unit_manager_1)

        response = self.broadcast(unit=self.unit_1)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(InternalMessage.objects.count(), 0)

    def test_unit_manager_cannot_broadcast_via_whitespace_only_recipient_id(self):
        # A whitespace-only recipient_id is truthy in the raw request body
        # but DRF's CharField(trim_whitespace=True) normalizes it to "" --
        # the gate must check the normalized value, not the raw input, or
        # this string is an unblocked bypass of the omitted-recipient case.
        self.authenticate(self.unit_manager_1)

        response = self.client.post(
            "/api/cms/internal-messages/",
            {
                "recipient_id": "   ",
                "recipient_role": UserProfile.Role.UNIT_MANAGER,
                "subject": "اطلاعیه",
                "body": "متن اطلاعیه آزمایشی",
                "unit_id": self.unit_1.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(InternalMessage.objects.count(), 0)

    def test_general_manager_can_broadcast_by_role(self):
        self.authenticate(self.general_manager)

        response = self.broadcast(unit=self.unit_1)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(InternalMessage.objects.count(), 1)

    def test_invalid_recipient_role_is_rejected(self):
        self.authenticate(self.general_manager)

        response = self.client.post(
            "/api/cms/internal-messages/",
            {
                "recipient_role": "not-a-real-role",
                "subject": "اطلاعیه",
                "body": "متن اطلاعیه آزمایشی",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("recipient_role", response.data)
        self.assertEqual(InternalMessage.objects.count(), 0)

    def test_create_rejects_recipient_outside_sender_scope(self):
        self.authenticate(self.unit_manager_1)

        response = self.send_message(self.unit_manager_2)

        self.assertEqual(response.status_code, 400)
        self.assertIn("recipient_id", response.data)
        self.assertEqual(InternalMessage.objects.count(), 0)

    def test_create_rejects_unknown_recipient_reference(self):
        self.authenticate(self.unit_manager_1)

        response = self.client.post(
            "/api/cms/internal-messages/",
            {
                "recipient_id": "user-does-not-exist",
                "subject": "موضوع",
                "body": "متن پیام آزمایشی",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("recipient_id", response.data)

    def test_create_allows_valid_in_scope_recipient(self):
        self.authenticate(self.unit_manager_1)

        response = self.send_message(self.unit_media_1)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(InternalMessage.objects.count(), 1)
        message = InternalMessage.objects.get()
        self.assertEqual(message.sender_id, self.unit_manager_1.id)
        self.assertEqual(message.recipient_id, self.unit_media_1.id)

    def test_create_allows_messaging_general_manager_from_any_unit(self):
        self.authenticate(self.unit_manager_2)

        response = self.send_message(self.general_manager)

        self.assertEqual(response.status_code, 201)

    def test_general_manager_can_message_any_active_user(self):
        self.authenticate(self.general_manager)

        response = self.send_message(self.unit_manager_2)

        self.assertEqual(response.status_code, 201)


class CMSStudentParentAssignmentTests(TestCase):
    """STUDENT-001: parent_id on the CMS student endpoint accepted ANY user
    account with no relationship validation, letting a Unit Manager inject
    an arbitrary student's identity into an uninvolved account's Parent
    panel just by knowing its numeric user ID."""

    def setUp(self):
        self.client = APIClient()

        self.unit_1 = SchoolUnit.objects.create(
            title="دبستان", slug="student-parent-unit-1", is_active=True, order=1,
        )

        self.unit_manager = self.create_user("stu-unitmanager", UserProfile.Role.UNIT_MANAGER)
        UserUnitMembership.objects.create(
            user=self.unit_manager,
            unit=self.unit_1,
            role=UserUnitMembership.UnitRole.UNIT_MANAGER,
            is_active=True,
        )

        self.unit_2 = SchoolUnit.objects.create(
            title="متوسطه", slug="student-parent-unit-2", is_active=True, order=2,
        )

        self.unrelated_staff = self.create_user("stu-unrelatedstaff", UserProfile.Role.UNIT_MEDIA)

        # A real Parent-role account, actually recognized as a parent of
        # unit_1 (the only way that happens today: a general manager set
        # it up via apps/accounts/cms.py).
        self.real_parent = self.create_user("stu-realparent", UserProfile.Role.PARENT)
        UserUnitMembership.objects.create(
            user=self.real_parent,
            unit=self.unit_1,
            role=UserUnitMembership.UnitRole.PARENT,
            is_active=True,
        )

        # "Parent B" from the original STUDENT-001 reproduction: a
        # perfectly real, active Parent account -- just with no
        # relationship to unit_1 at all. A role-only check would wrongly
        # accept this account; this is the case that must be rejected.
        self.unrelated_parent = self.create_user("stu-unrelatedparent", UserProfile.Role.PARENT)

        self.general_manager = self.create_user("stu-generalmanager", UserProfile.Role.GENERAL_MANAGER)

        # A manager with access to BOTH units, for the cross-unit-transfer
        # bypass scenario -- deliberately separate from self.unit_manager
        # (unit_1 only) so the other tests' assumptions don't shift.
        self.dual_unit_manager = self.create_user("stu-dualunitmanager", UserProfile.Role.UNIT_MANAGER)
        for unit in (self.unit_1, self.unit_2):
            UserUnitMembership.objects.create(
                user=self.dual_unit_manager,
                unit=unit,
                role=UserUnitMembership.UnitRole.UNIT_MANAGER,
                is_active=True,
            )

    def create_user(self, username, role):
        user = User.objects.create_user(
            username=username, password="password123", email=f"{username}@example.com",
        )
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.is_active = True
        profile.full_name = username
        profile.save()
        return user

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def create_student(self, *, parent_id, unit=None):
        return self.client.post(
            "/api/cms/students/",
            {
                "full_name": "دانش‌آموز آزمایشی",
                "unit_id": (unit or self.unit_1).pk,
                "parent_id": parent_id,
            },
            format="json",
        )

    def test_cannot_attach_a_student_to_a_non_parent_account(self):
        self.authenticate(self.unit_manager)

        response = self.create_student(parent_id=self.unrelated_staff.pk)

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Student.objects.filter(parent=self.unrelated_staff).exists())

    def test_cannot_attach_a_student_to_a_real_but_unrelated_parent_account(self):
        # The actual STUDENT-001 exploit: the target IS a genuine, active
        # Parent account -- just with no relationship to this unit at all.
        self.authenticate(self.unit_manager)

        response = self.create_student(parent_id=self.unrelated_parent.pk)

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Student.objects.filter(parent=self.unrelated_parent).exists())

    def test_can_attach_a_student_to_a_parent_recognized_for_that_unit(self):
        self.authenticate(self.unit_manager)

        response = self.create_student(parent_id=self.real_parent.pk)

        self.assertEqual(response.status_code, 201)
        self.assertTrue(Student.objects.filter(parent=self.real_parent).exists())

    def test_cannot_transfer_an_existing_students_parent_to_an_unrelated_account_via_patch(self):
        self.authenticate(self.unit_manager)
        created = self.create_student(parent_id=self.real_parent.pk)
        student_id = created.data["id"]

        response = self.client.patch(
            f"/api/cms/students/{student_id}/",
            {"parent_id": self.unrelated_parent.pk},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        student = Student.objects.get(pk=student_id)
        self.assertEqual(student.parent_id, self.real_parent.pk)

    def test_can_patch_other_fields_without_reproving_an_already_recognized_parent(self):
        # Round-2 regression: UnitScopedSerializerMixin.validate() only
        # writes attrs["unit"] back in one narrow auto-default case, so a
        # parent-only-omitting PATCH must still fall back to the
        # instance's own stored unit -- not wrongly treat it as unit=None
        # and reject an already-valid, unchanged relationship.
        self.authenticate(self.unit_manager)
        created = self.create_student(parent_id=self.real_parent.pk)
        student_id = created.data["id"]

        response = self.client.patch(
            f"/api/cms/students/{student_id}/",
            {"class_title": "دوم الف"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        student = Student.objects.get(pk=student_id)
        self.assertEqual(student.parent_id, self.real_parent.pk)
        self.assertEqual(student.class_title, "دوم الف")

    def test_cannot_move_a_student_to_a_unit_the_existing_parent_is_not_recognized_for(self):
        # The real STUDENT-001 bypass a manager with access to two units
        # could otherwise use: create a student in unit A with a parent
        # recognized only for unit A, then PATCH just unit_id to unit B
        # (a unit this manager also has access to) WITHOUT touching
        # parent_id at all -- the check must still run against the
        # existing parent, not skip because this one request didn't
        # mention "parent_id".
        self.authenticate(self.dual_unit_manager)
        created = self.create_student(parent_id=self.real_parent.pk, unit=self.unit_1)
        self.assertEqual(created.status_code, 201, created.data)
        student_id = created.data["id"]

        response = self.client.patch(
            f"/api/cms/students/{student_id}/",
            {"unit_id": self.unit_2.pk},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        student = Student.objects.get(pk=student_id)
        self.assertEqual(student.unit_id, self.unit_1.pk)

    def test_general_manager_is_not_restricted_to_a_recognized_parent(self):
        # General managers already have unrestricted authority everywhere
        # else in this codebase -- consistent here too.
        self.authenticate(self.general_manager)

        response = self.create_student(parent_id=self.unrelated_parent.pk)

        self.assertEqual(response.status_code, 201)
        self.assertTrue(Student.objects.filter(parent=self.unrelated_parent).exists())
