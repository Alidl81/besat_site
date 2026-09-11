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
from apps.site_settings.models import SiteSettings
from apps.units.models import SchoolUnit

from .models import PanelService, Program, Student
from .views import unit_performance_payloads, user_is_general_manager, user_is_parent


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

        registrations = RegistrationRequest.objects.filter(
            submitted_by=request.user,
        ).select_related(
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

        units = SchoolUnit.objects.real().order_by("order", "id")
        unit_payloads = unit_performance_payloads(units)
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


def panel_settings_payload(settings_obj):
    options = settings_obj.panel_options or {}
    return {
        "school_name": settings_obj.school_name or "",
        "current_academic_year_id": options.get("current_academic_year_id"),
        "default_unit_id": options.get("default_unit_id"),
        "notify_new_registration": bool(options.get("notify_new_registration", True)),
        "show_published_on_home": bool(options.get("show_published_on_home", True)),
        "autosave_forms": bool(options.get("autosave_forms", True)),
        "internal_messages_enabled": bool(options.get("internal_messages_enabled", True)),
        "academic_years": [],
        "units": [
            {"id": unit.id, "title": unit.title}
            for unit in SchoolUnit.objects.real().order_by("order", "id")
        ],
    }


class CMSSettingsAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]

    def _authorize(self, request):
        if not user_is_general_manager(request.user):
            raise PermissionDenied("Only general managers can manage site settings.")

    def get(self, request):
        self._authorize(request)
        settings_obj = SiteSettings.objects.get_active()
        if settings_obj is None:
            settings_obj = SiteSettings.objects.create(school_name=None, panel_options={})
        return Response(panel_settings_payload(settings_obj))

    def patch(self, request):
        self._authorize(request)
        settings_obj = SiteSettings.objects.get_active()
        if settings_obj is None:
            settings_obj = SiteSettings(panel_options={})

        payload = request.data if isinstance(request.data, dict) else {}
        school_name = str(payload.get("school_name", settings_obj.school_name or "")).strip()
        default_unit_id = payload.get("default_unit_id") or None
        if default_unit_id is not None:
            try:
                default_unit_id = int(default_unit_id)
            except (TypeError, ValueError):
                return Response({"default_unit_id": "واحد انتخاب‌شده معتبر نیست."}, status=400)
            if not SchoolUnit.objects.real().filter(pk=default_unit_id).exists():
                return Response({"default_unit_id": "واحد انتخاب‌شده معتبر نیست."}, status=400)

        current = settings_obj.panel_options or {}
        options = {
            **current,
            "current_academic_year_id": payload.get("current_academic_year_id") or None,
            "default_unit_id": default_unit_id,
            "notify_new_registration": bool(payload.get("notify_new_registration", current.get("notify_new_registration", True))),
            "show_published_on_home": bool(payload.get("show_published_on_home", current.get("show_published_on_home", True))),
            "autosave_forms": bool(payload.get("autosave_forms", current.get("autosave_forms", True))),
            "internal_messages_enabled": bool(payload.get("internal_messages_enabled", current.get("internal_messages_enabled", True))),
        }
        settings_obj.school_name = school_name or None
        settings_obj.panel_options = options
        settings_obj.is_active = True
        settings_obj.save()
        return Response(panel_settings_payload(settings_obj))


class PanelServicesAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]

    def get(self, request):
        # AUTH-DASH-SERVICES-001: `audience` used to come straight from
        # `request.query_params`, so any authenticated caller (a parent, in
        # particular) could request `?audience=staff` -- or omit the param
        # entirely, which never matched the "not in service.audiences"
        # exclusion at all -- and receive every active PanelService row
        # regardless of who it's actually meant for. The caller's audience
        # must be derived from their own authenticated role, never trusted
        # from the request.
        audience = "parent" if user_is_parent(request.user) else "staff"
        payload = []
        for service in PanelService.objects.filter(is_active=True):
            if service.audiences and audience not in service.audiences:
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
