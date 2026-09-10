from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework import status
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action

from apps.accounts.models import UserProfile
from apps.accounts.permissions import IsAuthenticatedAndActiveProfile
from apps.accounts.selectors import get_or_create_user_profile
from apps.news.permissions import get_accessible_unit_ids, is_general_manager

from .cms_serializers import (
    InternalMessageCreateSerializer,
    InternalMessageSerializer,
    ProgramSerializer,
    SchoolClassSerializer,
    StudentSerializer,
    get_message_recipient_queryset,
)
from .models import InternalMessage, Program, SchoolClass, Student


class UnitScopedCMSViewSet(ModelViewSet):
    permission_classes = [IsAuthenticatedAndActiveProfile]
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

    def get_queryset(self):
        # STUDENT-CONCURRENCY-001: two concurrent partial PATCHes to the
        # same Student are a classic read-validate-then-save lost-update
        # race -- both requests can fetch the pre-transfer row, both
        # validate cleanly against that (now stale) snapshot, and
        # whichever's Model.save() runs last silently overwrites the
        # other's already-committed change, since Django's default
        # ModelSerializer.update() calls instance.save() with no
        # update_fields and so rewrites every column from that request's
        # in-memory instance -- including fields the PATCH never touched.
        #
        # select_for_update() here makes get_object() (called by
        # update()/partial_update() below, itself wrapped in
        # transaction.atomic()) take a row lock on the target Student
        # BEFORE the serializer is even constructed, serializing any two
        # concurrent update requests for the same student. The second
        # request's select_for_update() blocks until the first commits,
        # then reads the FIRST request's already-committed state -- so
        # StudentSerializer.validate() (which falls back to
        # self.instance.parent/self.instance.unit for whichever field
        # this request didn't touch) validates against current data, not
        # a stale pre-transfer snapshot, and instance.save() can no
        # longer clobber the first request's committed fields with
        # stale in-memory values. This can correctly cause the second
        # request to now be rejected as invalid (e.g. a transfer that
        # was valid against the old parent/unit pairing but is no longer
        # valid against the pairing the first request just committed) --
        # that is the intended, non-silent outcome, not a bug.
        #
        # Only applied to the single-object update actions: list/create/
        # destroy have no comparable stale-instance overwrite risk, and
        # locking rows unnecessarily on read-only actions would only add
        # contention.
        queryset = super().get_queryset()
        if self.action in ("update", "partial_update"):
            queryset = queryset.select_for_update()
        return queryset

    def update(self, request, *args, **kwargs):
        # Holds the select_for_update() lock (see get_queryset() above)
        # from get_object() through validate() through save() -- i.e.
        # for the whole request -- not just around the final .save()
        # call. Locking only inside save() would be too late: by then
        # validate() has already run against whatever (possibly stale)
        # self.instance get_object() returned before the lock existed.
        with transaction.atomic():
            return super().update(request, *args, **kwargs)

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
    permission_classes = [IsAuthenticatedAndActiveProfile]

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
        users = get_message_recipient_queryset(request.user)
        payload = []
        for user in users.select_related("profile").order_by("username"):
            profile = get_or_create_user_profile(user)
            payload.append(
                {
                    "id": f"user-{user.get_username()}",
                    "full_name": profile.full_name or user.get_username(),
                    "role_display": UserProfile.Role(profile.role).label,
                }
            )
        return Response(payload)
