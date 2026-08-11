from django.contrib.auth import get_user_model
from django.test import TestCase

from .models import CourseEnrollment, InPersonCourseDetail, OnlineCourseDetail, Order
from .services import cart_service, checkout_service, payment_service
from .services.course_service import revoke_course_entitlements
from .tests import make_in_person_course, make_online_course

User = get_user_model()


def _pay(order, user):
    attempt, intent = payment_service.start_payment(order, actor=user, return_url="https://example.test/")
    token = intent.redirect_url.split("token=")[1].split("&")[0]
    return payment_service.handle_payment_callback(
        "mock", {"attempt_id": attempt.pk, "outcome": "success", "mock_token": token}
    )


class CourseEnrollmentTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="student_parent", password="x")

    def _buy(self, product):
        cart, _ = cart_service.get_or_create_active_cart(user=self.user)
        cart_service.add_item(cart, product_id=product.pk, variant_id=None, quantity=1)
        return checkout_service.place_order(cart, self.user)

    def test_no_enrollment_exists_before_payment(self):
        course = make_online_course()
        self._buy(course)

        self.assertFalse(CourseEnrollment.objects.filter(user=self.user, product=course).exists())

    def test_online_course_enrollment_carries_the_external_access_link_only_after_payment(self):
        course = make_online_course()
        course.online_course_detail.access_destination_type = OnlineCourseDetail.AccessDestinationType.EXTERNAL_LINK
        course.online_course_detail.access_destination_value = "https://class.example.com/secret-room"
        course.online_course_detail.access_duration_days = 30
        course.online_course_detail.save()

        order = self._buy(course)
        _pay(order, self.user)

        enrollment = CourseEnrollment.objects.get(user=self.user, product=course)
        self.assertEqual(enrollment.access_url, "https://class.example.com/secret-room")
        self.assertIsNotNone(enrollment.access_expires_at)
        self.assertTrue(enrollment.is_confirmed)

    def test_in_person_course_requiring_confirmation_grants_unconfirmed_enrollment(self):
        course = make_in_person_course()
        course.in_person_course_detail.requires_enrollment_confirmation = True
        course.in_person_course_detail.save()

        order = self._buy(course)
        _pay(order, self.user)

        enrollment = CourseEnrollment.objects.get(user=self.user, product=course)
        self.assertFalse(enrollment.is_confirmed)
        self.assertEqual(enrollment.status, CourseEnrollment.Status.ACTIVE)

    def test_enrollment_is_attached_to_purchasing_user_not_a_student_record(self):
        course = make_online_course()
        order = self._buy(course)
        _pay(order, self.user)

        enrollment = CourseEnrollment.objects.get(product=course)
        self.assertEqual(enrollment.user_id, self.user.id)

    def test_revoke_marks_enrollment_revoked_and_records_event(self):
        course = make_online_course()
        order = self._buy(course)
        _pay(order, self.user)
        enrollment = CourseEnrollment.objects.get(user=self.user, product=course)

        revoke_course_entitlements(order)

        enrollment.refresh_from_db()
        self.assertEqual(enrollment.status, CourseEnrollment.Status.REVOKED)
        self.assertIsNotNone(enrollment.revoked_at)
        self.assertTrue(order.events.filter(event_type="course_access_revoked").exists())

    def test_my_courses_endpoint_returns_only_my_active_enrollments(self):
        from rest_framework.test import APIClient

        course = make_online_course()
        order = self._buy(course)
        _pay(order, self.user)

        other_user = User.objects.create_user(username="other_parent", password="x")

        client = APIClient()
        client.force_authenticate(self.user)
        response = client.get("/api/shop/courses/my/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["product_title"], course.title)

        client.force_authenticate(other_user)
        response = client.get("/api/shop/courses/my/")
        self.assertEqual(response.data, [])
