from django.db.models import Q
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
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
    queryset = Student.objects.all()
    serializer_class = StudentSerializer


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
