from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from .models import Achievement
from .permissions import HasAchievementCMSPermission
from .serializers import (
    AchievementDetailSerializer,
    AchievementListSerializer,
    CMSAchievementDetailSerializer,
    CMSAchievementListSerializer,
    CMSAchievementWriteSerializer,
)


def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise DRFValidationError(error.message_dict)

    raise DRFValidationError(error.messages)


@extend_schema_view(
    list=extend_schema(
        tags=["Achievements"],
        summary="List active achievements",
        parameters=[
            OpenApiParameter("page", int, required=False),
            OpenApiParameter("unit_id", int, required=False),
            OpenApiParameter("featured", bool, required=False),
            OpenApiParameter("search", str, required=False),
            OpenApiParameter("ordering", str, required=False),
        ],
    ),
    retrieve=extend_schema(
        tags=["Achievements"],
        summary="Retrieve active achievement by slug",
        responses=AchievementDetailSerializer,
    ),
)
class AchievementViewSet(ReadOnlyModelViewSet):
    queryset = Achievement.objects.none()
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
        "related_unit__title",
    )
    ordering_fields = (
        "achievement_date",
        "title",
        "order",
    )
    ordering = (
        "order",
        "-achievement_date",
        "-id",
    )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Achievement.objects.none()

        today = timezone.localdate()

        queryset = (
            Achievement.objects.select_related("related_unit")
            .filter(is_active=True)
            .filter(
                Q(achievement_date__isnull=True)
                | Q(achievement_date__lte=today)
            )
            .exclude(
                related_unit__isnull=False,
                related_unit__is_active=False,
            )
            .order_by("order", "-achievement_date", "-id")
        )

        unit_id = self.request.query_params.get("unit_id")

        if unit_id:
            queryset = queryset.filter(related_unit_id=unit_id)

        featured = self.request.query_params.get("featured")

        if featured is not None:
            featured_value = featured.strip().lower()

            if featured_value in ("true", "1", "yes"):
                queryset = queryset.filter(is_featured=True)

            elif featured_value in ("false", "0", "no"):
                queryset = queryset.filter(is_featured=False)

        return queryset

    def get_serializer_class(self):
        if self.action == "retrieve":
            return AchievementDetailSerializer

        return AchievementListSerializer


@extend_schema_view(
    list=extend_schema(
        tags=["CMS - Achievements"],
        summary="CMS list achievements",
        parameters=[
            OpenApiParameter("unit_id", int, required=False),
            OpenApiParameter("featured", bool, required=False),
            OpenApiParameter("active", bool, required=False),
            OpenApiParameter("search", str, required=False),
            OpenApiParameter("ordering", str, required=False),
            OpenApiParameter("page", int, required=False),
        ],
    ),
    create=extend_schema(
        tags=["CMS - Achievements"],
        summary="CMS create achievement",
    ),
    retrieve=extend_schema(
        tags=["CMS - Achievements"],
        summary="CMS retrieve achievement",
    ),
    update=extend_schema(
        tags=["CMS - Achievements"],
        summary="CMS update achievement",
    ),
    partial_update=extend_schema(
        tags=["CMS - Achievements"],
        summary="CMS partially update achievement",
    ),
    destroy=extend_schema(
        tags=["CMS - Achievements"],
        summary="CMS delete achievement",
    ),
)
class CMSAchievementViewSet(ModelViewSet):
    queryset = Achievement.objects.none()
    permission_classes = [HasAchievementCMSPermission]
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
        "related_unit__title",
    )
    ordering_fields = (
        "achievement_date",
        "created_at",
        "updated_at",
        "title",
        "order",
    )
    ordering = (
        "order",
        "-achievement_date",
        "-id",
    )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Achievement.objects.none()

        queryset = (
            Achievement.objects.select_related(
                "related_unit",
                "created_by",
                "updated_by",
            )
            .order_by("order", "-achievement_date", "-id")
        )

        unit_id = self.request.query_params.get("unit_id")

        if unit_id:
            queryset = queryset.filter(related_unit_id=unit_id)

        featured = self.request.query_params.get("featured")

        if featured is not None:
            featured_value = featured.strip().lower()

            if featured_value in ("true", "1", "yes"):
                queryset = queryset.filter(is_featured=True)

            elif featured_value in ("false", "0", "no"):
                queryset = queryset.filter(is_featured=False)

        active = self.request.query_params.get("active")

        if active is not None:
            active_value = active.strip().lower()

            if active_value in ("true", "1", "yes"):
                queryset = queryset.filter(is_active=True)

            elif active_value in ("false", "0", "no"):
                queryset = queryset.filter(is_active=False)

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return CMSAchievementListSerializer

        if self.action in (
            "create",
            "update",
            "partial_update",
        ):
            return CMSAchievementWriteSerializer

        return CMSAchievementDetailSerializer

    def perform_create(self, serializer):
        try:
            serializer.save(
                created_by=self.request.user,
                updated_by=self.request.user,
            )
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    def perform_update(self, serializer):
        try:
            serializer.save(
                updated_by=self.request.user,
            )
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)