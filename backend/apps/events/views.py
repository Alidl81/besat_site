from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from apps.accounts.models import UserUnitMembership

from .models import Event
from .permissions import (
    HasEventCMSPermission,
    get_user_unit_ids,
    is_general_manager,
    is_unit_manager,
    is_unit_media,
)
from .serializers import (
    CMSEventDetailSerializer,
    CMSEventListSerializer,
    CMSEventWriteSerializer,
    EventDetailSerializer,
    EventListSerializer,
    EventWorkflowActionSerializer,
)


def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise DRFValidationError(error.message_dict)

    raise DRFValidationError(error.messages)


def parse_bool_param(value):
    if value is None:
        return None

    normalized = value.strip().lower()

    if normalized in ("true", "1", "yes"):
        return True

    if normalized in ("false", "0", "no"):
        return False

    return None


@extend_schema_view(
    list=extend_schema(
        tags=["Events"],
        summary="List published events",
        parameters=[
            OpenApiParameter("page", int, required=False),
            OpenApiParameter("scope", str, required=False),
            OpenApiParameter("unit_id", int, required=False),
            OpenApiParameter("featured", bool, required=False),
            OpenApiParameter("upcoming", bool, required=False),
            OpenApiParameter("search", str, required=False),
            OpenApiParameter("ordering", str, required=False),
        ],
    ),
    retrieve=extend_schema(
        tags=["Events"],
        summary="Retrieve published event by slug",
        responses=EventDetailSerializer,
    ),
)
class EventViewSet(ReadOnlyModelViewSet):
    queryset = Event.objects.none()
    permission_classes = [AllowAny]
    lookup_field = "slug"
    lookup_url_kwarg = "slug"

    filter_backends = (
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    search_fields = (
        "title",
        "summary",
        "description",
        "location",
        "unit__title",
    )
    ordering_fields = (
        "event_start_at",
        "published_at",
        "title",
        "order",
    )
    ordering = (
        "event_start_at",
        "order",
        "-id",
    )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Event.objects.none()

        today = timezone.localdate()
        now = timezone.now()

        queryset = (
            Event.objects.select_related("unit")
            .filter(
                is_active=True,
                status=Event.Status.PUBLISHED,
                published_at__isnull=False,
                published_at__lte=today,
            )
            .exclude(
                unit__isnull=False,
                unit__is_active=False,
            )
            .order_by("event_start_at", "order", "-id")
        )

        scope = self.request.query_params.get("scope")

        if scope:
            queryset = queryset.filter(scope=scope)

        unit_id = self.request.query_params.get("unit_id")

        if unit_id:
            queryset = queryset.filter(unit_id=unit_id)

        featured = parse_bool_param(self.request.query_params.get("featured"))

        if featured is not None:
            queryset = queryset.filter(is_featured=featured)

        upcoming = parse_bool_param(self.request.query_params.get("upcoming"))

        if upcoming is True:
            queryset = queryset.filter(event_start_at__gte=now)

        elif upcoming is False:
            queryset = queryset.filter(event_start_at__lt=now)

        return queryset

    def get_serializer_class(self):
        if self.action == "retrieve":
            return EventDetailSerializer

        return EventListSerializer


@extend_schema_view(
    list=extend_schema(
        tags=["CMS - Events"],
        summary="CMS list events",
        parameters=[
            OpenApiParameter("scope", str, required=False),
            OpenApiParameter("unit_id", int, required=False),
            OpenApiParameter("status", str, required=False),
            OpenApiParameter("featured", bool, required=False),
            OpenApiParameter("active", bool, required=False),
            OpenApiParameter("upcoming", bool, required=False),
            OpenApiParameter("search", str, required=False),
            OpenApiParameter("ordering", str, required=False),
            OpenApiParameter("page", int, required=False),
        ],
    ),
    create=extend_schema(
        tags=["CMS - Events"],
        summary="CMS create event",
    ),
    retrieve=extend_schema(
        tags=["CMS - Events"],
        summary="CMS retrieve event",
    ),
    update=extend_schema(
        tags=["CMS - Events"],
        summary="CMS update event",
    ),
    partial_update=extend_schema(
        tags=["CMS - Events"],
        summary="CMS partially update event",
    ),
    destroy=extend_schema(
        tags=["CMS - Events"],
        summary="CMS delete event",
    ),
)
class CMSEventViewSet(ModelViewSet):
    queryset = Event.objects.none()
    permission_classes = [HasEventCMSPermission]
    lookup_value_regex = r"\d+"
    parser_classes = (
        JSONParser,
        FormParser,
        MultiPartParser,
    )

    filter_backends = (
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    search_fields = (
        "title",
        "slug",
        "summary",
        "description",
        "location",
        "unit__title",
    )
    ordering_fields = (
        "event_start_at",
        "published_at",
        "created_at",
        "updated_at",
        "title",
        "order",
    )
    ordering = (
        "event_start_at",
        "order",
        "-id",
    )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Event.objects.none()

        queryset = (
            Event.objects.select_related(
                "unit",
                "created_by",
                "updated_by",
                "published_by",
            )
            .order_by("event_start_at", "order", "-id")
        )

        if not is_general_manager(self.request.user):
            unit_ids = get_user_unit_ids(
                self.request.user,
                roles=[
                    UserUnitMembership.UnitRole.UNIT_MANAGER,
                    UserUnitMembership.UnitRole.UNIT_MEDIA,
                ],
            )

            if not unit_ids:
                return Event.objects.none()

            queryset = queryset.filter(
                scope=Event.Scope.UNIT,
                unit_id__in=unit_ids,
            )

        scope = self.request.query_params.get("scope")

        if scope:
            queryset = queryset.filter(scope=scope)

        unit_id = self.request.query_params.get("unit_id")

        if unit_id:
            queryset = queryset.filter(unit_id=unit_id)

        status_param = self.request.query_params.get("status")

        if status_param:
            queryset = queryset.filter(status=status_param)

        featured = parse_bool_param(self.request.query_params.get("featured"))

        if featured is not None:
            queryset = queryset.filter(is_featured=featured)

        active = parse_bool_param(self.request.query_params.get("active"))

        if active is not None:
            queryset = queryset.filter(is_active=active)

        upcoming = parse_bool_param(self.request.query_params.get("upcoming"))

        if upcoming is not None:
            now = timezone.now()

            if upcoming:
                queryset = queryset.filter(event_start_at__gte=now)

            else:
                queryset = queryset.filter(event_start_at__lt=now)

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return CMSEventListSerializer

        if self.action in (
            "create",
            "update",
            "partial_update",
        ):
            return CMSEventWriteSerializer

        return CMSEventDetailSerializer

    def perform_create(self, serializer):
        self._validate_create_scope(serializer)

        try:
            serializer.save(
                created_by=self.request.user,
                updated_by=self.request.user,
            )
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    def perform_update(self, serializer):
        self._validate_update_scope(serializer)

        try:
            serializer.save(
                updated_by=self.request.user,
            )
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    def _validate_create_scope(self, serializer):
        if is_general_manager(self.request.user):
            return

        scope = serializer.validated_data.get("scope", Event.Scope.UNIT)
        unit = serializer.validated_data.get("unit")

        if scope != Event.Scope.UNIT:
            raise PermissionDenied("کاربر واحد فقط می‌تواند رویداد واحدی ایجاد کند.")

        if unit is None:
            raise DRFValidationError(
                {
                    "unit": "انتخاب واحد برای کاربر واحد الزامی است.",
                }
            )

        unit_ids = get_user_unit_ids(
            self.request.user,
            roles=[
                UserUnitMembership.UnitRole.UNIT_MANAGER,
                UserUnitMembership.UnitRole.UNIT_MEDIA,
            ],
        )

        if unit.id not in unit_ids:
            raise PermissionDenied("شما به این واحد دسترسی ندارید.")

    def _validate_update_scope(self, serializer):
        if is_general_manager(self.request.user):
            return

        instance = self.get_object()

        if instance.scope != Event.Scope.UNIT:
            raise PermissionDenied("شما به این رویداد دسترسی ندارید.")

        unit_ids = get_user_unit_ids(
            self.request.user,
            roles=[
                UserUnitMembership.UnitRole.UNIT_MANAGER,
                UserUnitMembership.UnitRole.UNIT_MEDIA,
            ],
        )

        new_unit = serializer.validated_data.get("unit", instance.unit)

        if not new_unit or new_unit.id not in unit_ids:
            raise PermissionDenied("شما به این واحد دسترسی ندارید.")

    def _workflow_note(self, request):
        serializer = EventWorkflowActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        note = serializer.validated_data.get("note")

        if isinstance(note, str):
            note = note.strip()

        return note or None

    def _save_workflow(self, event):
        try:
            event.save()
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    def _can_review_event(self, event):
        if is_general_manager(self.request.user):
            return True

        if not is_unit_manager(self.request.user):
            return False

        unit_ids = get_user_unit_ids(
            self.request.user,
            roles=[
                UserUnitMembership.UnitRole.UNIT_MANAGER,
            ],
        )

        return event.scope == Event.Scope.UNIT and event.unit_id in unit_ids

    @action(detail=True, methods=["post"], url_path="submit-review")
    def submit_review(self, request, pk=None):
        event = self.get_object()

        if event.status not in (
            Event.Status.DRAFT,
            Event.Status.REJECTED,
        ):
            raise DRFValidationError(
                {
                    "status": "فقط رویداد پیش‌نویس یا ردشده قابل ارسال برای بررسی است.",
                }
            )

        event.status = Event.Status.WAITING_REVIEW
        event.review_note = self._workflow_note(request)
        event.updated_by = request.user
        self._save_workflow(event)

        return Response(CMSEventDetailSerializer(event, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        event = self.get_object()

        if not self._can_review_event(event):
            raise PermissionDenied("شما اجازه تایید این رویداد را ندارید.")

        if event.status != Event.Status.WAITING_REVIEW:
            raise DRFValidationError(
                {
                    "status": "فقط رویداد در انتظار بررسی قابل تایید است.",
                }
            )

        event.status = Event.Status.APPROVED
        event.review_note = self._workflow_note(request)
        event.updated_by = request.user
        self._save_workflow(event)

        return Response(CMSEventDetailSerializer(event, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        event = self.get_object()

        if not is_general_manager(request.user):
            raise PermissionDenied("فقط مدیر کل اجازه انتشار رویداد را دارد.")

        if event.status not in (
            Event.Status.APPROVED,
            Event.Status.WAITING_REVIEW,
            Event.Status.DRAFT,
        ):
            raise DRFValidationError(
                {
                    "status": "این رویداد در وضعیت قابل انتشار نیست.",
                }
            )

        event.status = Event.Status.PUBLISHED
        event.published_at = timezone.localdate()
        event.published_by = request.user
        event.updated_by = request.user
        event.is_active = True
        event.review_note = self._workflow_note(request)
        self._save_workflow(event)

        return Response(CMSEventDetailSerializer(event, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        event = self.get_object()

        if not self._can_review_event(event):
            raise PermissionDenied("شما اجازه رد این رویداد را ندارید.")

        if event.status not in (
            Event.Status.WAITING_REVIEW,
            Event.Status.APPROVED,
        ):
            raise DRFValidationError(
                {
                    "status": "فقط رویداد در انتظار بررسی یا تاییدشده قابل رد است.",
                }
            )

        event.status = Event.Status.REJECTED
        event.review_note = self._workflow_note(request)
        event.updated_by = request.user
        self._save_workflow(event)

        return Response(CMSEventDetailSerializer(event, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, pk=None):
        event = self.get_object()

        if not self._can_review_event(event):
            raise PermissionDenied("شما اجازه آرشیو این رویداد را ندارید.")

        event.status = Event.Status.ARCHIVED
        event.is_active = False
        event.review_note = self._workflow_note(request)
        event.updated_by = request.user
        self._save_workflow(event)

        return Response(CMSEventDetailSerializer(event, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, pk=None):
        event = self.get_object()

        if not self._can_review_event(event):
            raise PermissionDenied("شما اجازه بازگردانی این رویداد را ندارید.")

        if event.status != Event.Status.ARCHIVED:
            raise DRFValidationError(
                {
                    "status": "فقط رویداد آرشیوشده قابل بازگردانی است.",
                }
            )

        event.status = Event.Status.DRAFT
        event.is_active = True
        event.review_note = self._workflow_note(request)
        event.updated_by = request.user
        self._save_workflow(event)

        return Response(CMSEventDetailSerializer(event, context={"request": request}).data)