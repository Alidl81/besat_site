import csv

from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAuthenticatedAndActiveProfile
from apps.accounts.selectors import get_or_create_user_profile
from apps.registration.models import RegistrationRequest

from .models import PanelService, Program, Student
from .views import user_is_general_manager, user_is_parent


def parent_child_payload(student):
    return {
        "id": student.id,
        "full_name": student.full_name,
        "avatar_url": None,
        "grade_title": None,
        "class_title": student.class_title,
        "major": None,
        "unit_title": student.unit.title if student.unit_id else None,
        "is_active": True,
    }


class ParentChildrenAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]

    def get_queryset(self):
        if not user_is_parent(self.request.user):
            raise PermissionDenied("Only parent accounts can view child records.")
        return Student.objects.filter(parent=self.request.user).select_related("unit")

    def get(self, request):
        return Response(
            [parent_child_payload(student) for student in self.get_queryset()],
        )


class ParentChildDetailAPIView(ParentChildrenAPIView):
    def get(self, request, pk):
        student = self.get_queryset().filter(pk=pk).first()
        if student is None:
            return Response({"detail": "Not found."}, status=404)

        payload = parent_child_payload(student)
        payload.update(
            {
                "average": None,
                "class_rank": None,
                "grade_rank": None,
                "teachers": [],
                "latest_grades": [],
                "attendance": None,
                "exams": [],
                "assignments": [],
                "schedule": [],
                "counselor_message": None,
                "quick_links": [],
            },
        )
        return Response(payload)


class ParentProgramsAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]

    def get(self, request):
        if not user_is_parent(request.user):
            raise PermissionDenied("Only parent accounts can view programmes.")

        children = Student.objects.filter(parent=request.user)
        child_id = request.query_params.get("child")
        if child_id:
            children = children.filter(pk=child_id)
        unit_ids = children.exclude(unit_id=None).values_list("unit_id", flat=True)
        programs = Program.objects.filter(
            Q(unit_id__in=unit_ids) | Q(unit_id=None),
        ).select_related("unit")
        results = [
            {
                "id": program.id,
                "title": program.title,
                "description": program.description,
                "location": None,
                "starts_at": program.date,
                "ends_at": None,
                "unit": (
                    {"id": program.unit_id, "title": program.unit.title}
                    if program.unit_id
                    else None
                ),
            }
            for program in programs
        ]
        return Response(
            {"count": len(results), "next": None, "previous": None, "results": results},
        )


class ParentRegistrationsAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]

    def get(self, request):
        if not user_is_parent(request.user):
            raise PermissionDenied("Only parent accounts can view registrations.")

        profile = get_or_create_user_profile(request.user)
        identifiers = Q()
        if profile.phone:
            identifiers |= Q(parent_phone=profile.phone)
        if request.user.email:
            identifiers |= Q(parent_email__iexact=request.user.email)
        if not identifiers:
            return Response([])

        registrations = RegistrationRequest.objects.filter(identifiers).select_related(
            "requested_unit",
        )
        return Response(
            [
                {
                    "id": registration.id,
                    "child": {
                        "id": registration.id,
                        "full_name": registration.student_full_name,
                        "avatar_url": None,
                        "grade_title": registration.requested_grade,
                        "class_title": None,
                        "major": None,
                        "unit_title": registration.requested_unit.title,
                        "is_active": True,
                    },
                    "academic_year": None,
                    "status": registration.status,
                    "progress_percent": {
                        RegistrationRequest.Status.NEW: 0,
                        RegistrationRequest.Status.REVIEWING: 25,
                        RegistrationRequest.Status.NEEDS_DOCUMENTS: 50,
                        RegistrationRequest.Status.CONTACTED: 50,
                        RegistrationRequest.Status.ACCEPTED: 100,
                        RegistrationRequest.Status.REJECTED: 100,
                        RegistrationRequest.Status.ARCHIVED: 100,
                    }[registration.status],
                    "next_action_url": None,
                    "steps": [],
                }
                for registration in registrations
            ],
        )


class ReportsOverviewAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]

    def get(self, request):
        if not user_is_general_manager(request.user):
            raise PermissionDenied("Only general managers can view reports.")

        from apps.accounts.models import UserProfile
        from apps.units.models import SchoolUnit

        units = SchoolUnit.objects.filter(is_active=True).order_by("order", "id")
        unit_payloads = [
            {
                "id": unit.id,
                "title": unit.title,
                "students_count": Student.objects.filter(unit=unit).count(),
                "staff_count": 0,
                "new_registrations_count": RegistrationRequest.objects.filter(
                    requested_unit=unit,
                    created_at__year=timezone.now().year,
                ).count(),
                "published_content_count": 0,
                "is_active": unit.is_active,
            }
            for unit in units
        ]
        return Response(
            {
                "metrics": [
                    {
                        "key": "students",
                        "title": "Students",
                        "value": Student.objects.count(),
                        "detail": None,
                        "trend": None,
                        "tone": "blue",
                        "icon": "students",
                    },
                    {
                        "key": "registrations",
                        "title": "Registrations",
                        "value": RegistrationRequest.objects.count(),
                        "detail": None,
                        "trend": None,
                        "tone": "green",
                        "icon": "document",
                    },
                    {
                        "key": "parents",
                        "title": "Parent accounts",
                        "value": UserProfile.objects.filter(
                            role=UserProfile.Role.PARENT,
                        ).count(),
                        "detail": None,
                        "trend": None,
                        "tone": "purple",
                        "icon": "users",
                    },
                ],
                "units": unit_payloads,
            },
        )


class ReportsExportAPIView(ReportsOverviewAPIView):
    def get(self, request):
        overview = super().get(request)
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="panel-report.csv"'
        writer = csv.writer(response)
        writer.writerow(("unit", "students", "new_registrations"))
        for unit in overview.data["units"]:
            writer.writerow((unit["title"], unit["students_count"], unit["new_registrations_count"]))
        return response


class PanelServicesAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]

    def get(self, request):
        audience = request.query_params.get("audience")
        payload = []
        for service in PanelService.objects.filter(is_active=True):
            if audience and service.audiences and audience not in service.audiences:
                continue
            payload.append({
                "id": service.id,
                "title": service.title,
                "description": service.description,
                "icon": service.icon,
                "url": service.url,
                "is_external": service.is_external,
            })
        return Response(payload)
