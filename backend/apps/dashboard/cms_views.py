from django.db.models import Q
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action

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
    allowed_roles = (UserProfile.Role.GENERAL_MANAGER, UserProfile.Role.UNIT_MANAGER)

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        profile = get_or_create_user_profile(request.user)
        if profile.role not in self.allowed_roles and not is_general_manager(request.user):
            raise PermissionDenied("این ماژول در محدوده نقش شما نیست.")

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

    @action(detail=False, methods=("get",), url_path="summary")
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        completed = queryset.filter(
            national_code__isnull=False,
            unit__isnull=False,
        ).exclude(national_code="")

        return Response(
            {
                "total": queryset.count(),
                "completed_profiles": completed.count(),
                "new_this_year": queryset.filter(
                    created_at__year=timezone.now().year,
                ).count(),
                "incomplete_profiles": queryset.exclude(pk__in=completed).count(),
            }
        )


class CMSClassViewSet(UnitScopedCMSViewSet):
    queryset = SchoolClass.objects.all()
    serializer_class = SchoolClassSerializer
    allowed_roles = (UserProfile.Role.GENERAL_MANAGER,)


class CMSProgramViewSet(UnitScopedCMSViewSet):
    queryset = Program.objects.all()
    serializer_class = ProgramSerializer


class CMSInternalMessageViewSet(ModelViewSet):
    queryset = InternalMessage.objects.all()
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        profile = get_or_create_user_profile(user)
        queryset = InternalMessage.objects.filter(
            Q(sender=user) | Q(recipient=user) | Q(recipient__isnull=True, recipient_role=profile.role)
        ).distinct()
        folder = self.request.query_params.get("folder")
        if folder == "inbox":
            queryset = queryset.filter(
                Q(recipient=user) |
                Q(recipient__isnull=True, recipient_role=profile.role)
            )
        elif folder == "sent":
            queryset = queryset.filter(sender=user)
        return queryset

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

    def perform_update(self, serializer):
        message = serializer.instance
        if message.recipient_id == self.request.user.id:
            unexpected = set(serializer.validated_data) - {"is_read"}
            if unexpected:
                raise PermissionDenied("گیرنده فقط می‌تواند وضعیت خوانده‌شدن پیام را تغییر دهد.")
            serializer.save()
            return
        if message.sender_id != self.request.user.id:
            raise PermissionDenied("اجازه ویرایش این پیام را ندارید.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.sender_id != self.request.user.id:
            raise PermissionDenied("فقط فرستنده می‌تواند پیام را حذف کند.")
        instance.delete()

    @action(detail=True, methods=("post",), url_path="mark-read")
    def mark_read(self, request, pk=None):
        message = self.get_object()
        profile = get_or_create_user_profile(request.user)
        can_read = (
            message.recipient_id == request.user.id
            or (
                message.recipient_id is None
                and message.recipient_role == profile.role
            )
        )
        if not can_read:
            raise PermissionDenied("فقط گیرنده می‌تواند پیام را خوانده‌شده علامت بزند.")
        message.is_read = True
        message.save(update_fields=("is_read", "updated_at"))
        return Response(
            InternalMessageSerializer(
                message,
                context=self.get_serializer_context(),
            ).data
        )

    @action(detail=False, methods=("get",), url_path="recipients")
    def recipients(self, request):
        User = get_user_model()
        users = User.objects.filter(is_active=True).exclude(pk=request.user.pk)
        if not is_general_manager(request.user):
            accessible_unit_ids = get_accessible_unit_ids(request.user)
            users = users.filter(
                Q(profile__role=UserProfile.Role.GENERAL_MANAGER)
                | Q(unit_memberships__unit_id__in=accessible_unit_ids)
            )
        payload = []
        for user in users.select_related("profile").distinct().order_by("username"):
            profile = get_or_create_user_profile(user)
            payload.append(
                {
                    "id": f"user-{user.get_username()}",
                    "full_name": profile.full_name or user.get_username(),
                    "role_display": UserProfile.Role(profile.role).label,
                }
            )
        return Response(payload)
