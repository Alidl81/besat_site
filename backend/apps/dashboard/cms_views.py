import csv

from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.viewsets import ModelViewSet

from apps.accounts.models import UserProfile
from apps.accounts.selectors import get_or_create_user_profile
from apps.news.permissions import get_accessible_unit_ids, is_general_manager

from .cms_serializers import (
    InternalMessageCreateSerializer,
    InternalMessageSerializer,
    ProgramSerializer,
    SchoolClassSerializer,
    StudentSerializer,
)
from .models import InternalMessage, Program, SchoolClass, Student


def complete_student_profile_filter():
    return (
        Q(national_code__isnull=False)
        & ~Q(national_code="")
        & Q(unit__isnull=False)
        & Q(class_title__isnull=False)
        & ~Q(class_title="")
    )


class UnitScopedCMSViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        if is_general_manager(self.request.user):
            return queryset
        profile = get_or_create_user_profile(self.request.user)
        if profile.role == UserProfile.Role.PARENT and self.queryset.model is Student:
            return queryset.filter(parent=self.request.user)
        return queryset.filter(unit_id__in=get_accessible_unit_ids(self.request.user))

    def perform_destroy(self, instance):
        if not is_general_manager(self.request.user):
            unit_id = getattr(instance, "unit_id", None)
            if unit_id not in get_accessible_unit_ids(self.request.user):
                raise PermissionDenied("این رکورد در محدوده دسترسی شما نیست.")
        instance.delete()


class CMSStudentViewSet(UnitScopedCMSViewSet):
    queryset = Student.objects.select_related("unit", "parent", "parent__profile").all()
    serializer_class = StudentSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search)
                | Q(national_code__icontains=search)
                | Q(class_title__icontains=search)
            )

        unit_id = self.request.query_params.get("unit")
        if unit_id:
            try:
                queryset = queryset.filter(unit_id=int(unit_id))
            except (TypeError, ValueError):
                raise ValidationError({"unit": "شناسه واحد معتبر نیست."})

        profile_status = self.request.query_params.get("profile_status")
        complete_filter = complete_student_profile_filter()
        if profile_status == "complete":
            queryset = queryset.filter(complete_filter)
        elif profile_status == "incomplete":
            queryset = queryset.exclude(complete_filter)

        return queryset

    @action(detail=False, methods=("get",), url_path="summary")
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        completed = queryset.filter(complete_student_profile_filter()).count()
        total = queryset.count()

        return Response(
            {
                "total": total,
                "completed_profiles": completed,
                "new_this_year": queryset.filter(
                    created_at__year=timezone.localdate().year,
                ).count(),
                "incomplete_profiles": total - completed,
            }
        )

    @action(detail=False, methods=("get",), url_path="export")
    def export(self, request):
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = (
            'attachment; filename="besat-students.csv"'
        )
        response.write("\ufeff")
        writer = csv.writer(response, lineterminator="\r\n")
        writer.writerow(
            ("full_name", "national_code", "unit_id", "class_title", "parent_id")
        )

        for student in self.filter_queryset(self.get_queryset()):
            writer.writerow(
                (
                    student.full_name,
                    student.national_code or "",
                    student.unit_id or "",
                    student.class_title or "",
                    student.parent_id or "",
                )
            )

        return response


class CMSClassViewSet(UnitScopedCMSViewSet):
    queryset = SchoolClass.objects.all()
    serializer_class = SchoolClassSerializer


class CMSProgramViewSet(UnitScopedCMSViewSet):
    queryset = Program.objects.all()
    serializer_class = ProgramSerializer


class CMSInternalMessageViewSet(ModelViewSet):
    queryset = InternalMessage.objects.all()
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        profile = get_or_create_user_profile(user)
        return InternalMessage.objects.filter(
            Q(sender=user) | Q(recipient=user) | Q(recipient__isnull=True, recipient_role=profile.role)
        ).distinct()

    def get_serializer_class(self):
        if self.action == "create":
            return InternalMessageCreateSerializer
        return InternalMessageSerializer

    def create(self, request, *args, **kwargs):
        serializer = InternalMessageCreateSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        output = InternalMessageSerializer(
            message,
            context=self.get_serializer_context(),
        )
        return Response(output.data, status=status.HTTP_201_CREATED)
