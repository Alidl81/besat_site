from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.accounts.permissions import IsAuthenticatedAndActiveProfile
from apps.accounts.selectors import get_or_create_user_profile, get_user_units_payload
from apps.announcements.models import Announcement
from apps.events.models import Event
from apps.gallery.models import GalleryItem
from apps.news.models import News
from apps.registration.models import RegistrationRequest
from apps.staff.models import StaffMember
from apps.units.models import SchoolUnit

from .models import InternalMessage, Student
from .serializers import DashboardResponseSerializer


User = get_user_model()


def user_is_general_manager(user) -> bool:
    profile = get_or_create_user_profile(user)

    return user.is_superuser or profile.role == UserProfile.Role.GENERAL_MANAGER


def user_is_unit_manager(user) -> bool:
    if user_is_general_manager(user):
        return False

    profile = get_or_create_user_profile(user)

    return profile.role == UserProfile.Role.UNIT_MANAGER


def user_is_unit_media(user) -> bool:
    if user_is_general_manager(user):
        return False

    profile = get_or_create_user_profile(user)

    return profile.role == UserProfile.Role.UNIT_MEDIA


def user_is_parent(user) -> bool:
    if user_is_general_manager(user):
        return False

    profile = get_or_create_user_profile(user)

    return profile.role == UserProfile.Role.PARENT


def unit_payload(unit):
    if unit is None:
        return None

    return {
        "id": unit.id,
        "title": unit.title,
        "slug": unit.slug,
    }


def profile_payload(user):
    profile = get_or_create_user_profile(user)

    return {
        "id": profile.id,
        "full_name": profile.full_name,
        "phone": profile.phone,
        "description": profile.description,
        "role": profile.role,
        "role_display": profile.get_role_display(),
        "username": user.get_username(),
        "email": user.email,
    }


def get_accessible_units_for_dashboard(user, allowed_roles: tuple[str, ...] | None = None):
    if user_is_general_manager(user):
        return SchoolUnit.objects.filter(is_active=True).order_by("order", "id")

    queryset = UserUnitMembership.objects.select_related("unit").filter(
        user=user,
        is_active=True,
        unit__is_active=True,
    )

    if allowed_roles:
        queryset = queryset.filter(role__in=allowed_roles)

    unit_ids = queryset.values_list("unit_id", flat=True)

    return SchoolUnit.objects.filter(id__in=unit_ids, is_active=True).order_by("order", "id")


def resolve_selected_unit(request, allowed_roles: tuple[str, ...] | None = None):
    units_queryset = get_accessible_units_for_dashboard(
        request.user,
        allowed_roles=allowed_roles,
    )

    accessible_units = [
        unit_payload(unit)
        for unit in units_queryset
    ]

    requested_unit_id = request.query_params.get("unit_id")

    if requested_unit_id:
        try:
            requested_unit_id = int(requested_unit_id)
        except (TypeError, ValueError):
            raise PermissionDenied("شناسه واحد معتبر نیست.")

        selected_unit = units_queryset.filter(id=requested_unit_id).first()

        if selected_unit is None:
            raise PermissionDenied("شما به این واحد دسترسی ندارید.")

        return selected_unit, accessible_units

    selected_unit = units_queryset.first()

    return selected_unit, accessible_units


class DashboardContextAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]

    @extend_schema(
        tags=["Dashboard"],
        summary="Get the shared dashboard context",
        responses=OpenApiTypes.OBJECT,
    )
    def get(self, request):
        profile = get_or_create_user_profile(request.user)
        units_queryset = get_accessible_units_for_dashboard(request.user)
        units = [
            {"id": unit.id, "title": unit.title}
            for unit in units_queryset
        ]

        requested_unit_id = request.query_params.get("unit")
        if requested_unit_id:
            try:
                requested_unit_id = int(requested_unit_id)
            except (TypeError, ValueError):
                raise PermissionDenied("شناسه واحد معتبر نیست.")

            if not units_queryset.filter(id=requested_unit_id).exists():
                raise PermissionDenied("شما به این واحد دسترسی ندارید.")
            selected_unit_id = requested_unit_id
        elif user_is_general_manager(request.user):
            selected_unit_id = None
        else:
            selected_unit_id = units_queryset.values_list("id", flat=True).first()

        children_queryset = Student.objects.filter(parent=request.user).order_by(
            "full_name",
            "id",
        )
        children = [
            {
                "id": child.id,
                "title": child.full_name,
                "subtitle": child.class_title,
                "avatar_url": None,
            }
            for child in children_queryset
        ]
        requested_child_id = request.query_params.get("child")
        if requested_child_id:
            try:
                requested_child_id = int(requested_child_id)
            except (TypeError, ValueError):
                raise PermissionDenied("شناسه فرزند معتبر نیست.")

            if not children_queryset.filter(id=requested_child_id).exists():
                raise PermissionDenied("شما به این پرونده فرزند دسترسی ندارید.")
            selected_child_id = requested_child_id
        else:
            selected_child_id = children_queryset.values_list("id", flat=True).first()

        avatar_url = (
            request.build_absolute_uri(profile.avatar.url)
            if profile.avatar
            else None
        )

        return Response(
            {
                "user": {
                    "id": request.user.id,
                    "full_name": profile.full_name or request.user.get_username(),
                    "role_display": profile.get_role_display(),
                    "avatar_url": avatar_url,
                },
                "academic_years": [],
                "selected_academic_year_id": None,
                "units": units,
                "selected_unit_id": selected_unit_id,
                "children": children,
                "selected_child_id": selected_child_id,
                "unread_notifications": 0,
                "unread_messages": InternalMessage.objects.filter(
                    recipient=request.user,
                    is_read=False,
                ).count(),
                "current_date": timezone.now().isoformat(),
            }
        )


def status_counts(queryset, model_class) -> dict:
    data = {
        "total": queryset.count(),
    }

    for status_value, _status_label in model_class.Status.choices:
        data[status_value] = queryset.filter(status=status_value).count()

    return data


def content_status_payload(news_queryset, announcement_queryset, gallery_queryset) -> dict:
    news_counts = status_counts(news_queryset, News)
    announcement_counts = status_counts(announcement_queryset, Announcement)
    gallery_counts = status_counts(gallery_queryset, GalleryItem)

    pending_review_total = (
        news_counts.get(News.Status.WAITING_REVIEW, 0)
        + announcement_counts.get(Announcement.Status.WAITING_REVIEW, 0)
        + gallery_counts.get(GalleryItem.Status.WAITING_REVIEW, 0)
    )

    published_total = (
        news_counts.get(News.Status.PUBLISHED, 0)
        + announcement_counts.get(Announcement.Status.PUBLISHED, 0)
        + gallery_counts.get(GalleryItem.Status.PUBLISHED, 0)
    )

    return {
        "news": news_counts,
        "announcements": announcement_counts,
        "gallery": gallery_counts,
        "pending_review_total": pending_review_total,
        "published_total": published_total,
        "total": (
            news_counts["total"]
            + announcement_counts["total"]
            + gallery_counts["total"]
        ),
    }


def iso_datetime(value):
    if value is None:
        return None

    return value.isoformat()


def content_item_payload(item, content_type: str) -> dict:
    return {
        "type": content_type,
        "id": item.id,
        "title": item.title,
        "slug": item.slug,
        "status": item.status,
        "scope": item.scope,
        "unit_id": item.unit_id,
        "unit": unit_payload(item.unit),
        "updated_at": iso_datetime(item.updated_at),
        "created_at": iso_datetime(item.created_at),
    }


def latest_activity(news_queryset, announcement_queryset, gallery_queryset, limit=10) -> list[dict]:
    items = []

    for item in news_queryset.select_related("unit").order_by("-updated_at", "-id")[:limit]:
        items.append(content_item_payload(item, "news"))

    for item in announcement_queryset.select_related("unit").order_by("-updated_at", "-id")[:limit]:
        items.append(content_item_payload(item, "announcement"))

    for item in gallery_queryset.select_related("unit").order_by("-updated_at", "-id")[:limit]:
        items.append(content_item_payload(item, "gallery"))

    items = sorted(
        items,
        key=lambda item: item.get("updated_at") or "",
        reverse=True,
    )

    return items[:limit]


def frontend_metrics(cards: list[dict], limit=4) -> list[dict]:
    tones = ("blue", "purple", "green", "amber")
    icons = {
        "units": "units",
        "active_users": "users",
        "content_total": "document",
        "pending_review": "review",
        "published": "check",
        "gallery": "image",
        "gallery_total": "image",
        "gallery_draft": "document",
        "gallery_waiting_review": "review",
        "gallery_published": "check",
        "accessible_units": "units",
    }

    return [
        {
            "key": card["key"],
            "title": card["label"],
            "value": card["value"],
            "detail": card.get("description"),
            "trend": None,
            "tone": tones[index % len(tones)],
            "icon": icons.get(card["key"], "chart"),
        }
        for index, card in enumerate(cards[:limit])
    ]


def message_feed(user, limit=5) -> list[dict]:
    messages = InternalMessage.objects.filter(
        Q(sender=user) | Q(recipient=user)
    ).order_by("-created_at", "-id")[:limit]

    return [
        {
            "id": message.id,
            "title": message.subject,
            "description": message.body,
            "timestamp": iso_datetime(message.created_at),
            "status": "read" if message.is_read else "unread",
            "href": "/dashboard/admin/messages",
            "avatar_url": None,
        }
        for message in messages
    ]


def event_feed(queryset, limit=5) -> list[dict]:
    return [
        {
            "id": event.id,
            "title": event.title,
            "description": event.summary or event.description,
            "timestamp": iso_datetime(event.event_start_at),
            "status": event.status,
            "href": "/dashboard/admin/events",
            "avatar_url": None,
        }
        for event in queryset.order_by("event_start_at", "id")[:limit]
    ]


def announcement_feed(queryset, limit=5) -> list[dict]:
    return [
        {
            "id": announcement.id,
            "title": announcement.title,
            "description": announcement.summary,
            "timestamp": iso_datetime(announcement.updated_at),
            "status": announcement.status,
            "href": "/dashboard/admin/announcements",
            "avatar_url": None,
        }
        for announcement in queryset.order_by("-updated_at", "-id")[:limit]
    ]


def unit_performance_feed(queryset) -> list[dict]:
    units = list(queryset.order_by("order", "id"))
    return [
        {
            "id": unit.id,
            "title": unit.title,
            "students_count": Student.objects.filter(unit=unit).count(),
            "staff_count": StaffMember.objects.filter(unit=unit, is_active=True).count(),
            "new_registrations_count": RegistrationRequest.objects.filter(
                requested_unit=unit,
                status=RegistrationRequest.Status.NEW,
            ).count(),
            "published_content_count": (
                News.objects.filter(unit=unit, status=News.Status.PUBLISHED).count()
                + Announcement.objects.filter(
                    unit=unit,
                    status=Announcement.Status.PUBLISHED,
                ).count()
                + GalleryItem.objects.filter(
                    unit=unit,
                    status=GalleryItem.Status.PUBLISHED,
                ).count()
            ),
            "is_active": unit.is_active,
        }
        for unit in units
    ]


class GeneralManagerDashboardAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]

    @extend_schema(
        tags=["Dashboard"],
        summary="General manager dashboard",
        responses=DashboardResponseSerializer,
    )
    def get(self, request):
        if not user_is_general_manager(request.user):
            raise PermissionDenied("شما اجازه دسترسی به داشبورد مدیر کل را ندارید.")

        news_queryset = News.objects.select_related("unit").all()
        announcement_queryset = Announcement.objects.select_related("unit").all()
        gallery_queryset = GalleryItem.objects.select_related("unit").all()

        content_status = content_status_payload(
            news_queryset=news_queryset,
            announcement_queryset=announcement_queryset,
            gallery_queryset=gallery_queryset,
        )

        active_units_count = SchoolUnit.objects.filter(is_active=True).count()
        active_users_count = User.objects.filter(is_active=True).count()

        stats = {
            "units_count": active_units_count,
            "users_count": User.objects.count(),
            "active_users_count": active_users_count,
            "profiles_count": UserProfile.objects.count(),
            "general_managers_count": UserProfile.objects.filter(
                role=UserProfile.Role.GENERAL_MANAGER,
                is_active=True,
            ).count(),
            "unit_managers_count": UserProfile.objects.filter(
                role=UserProfile.Role.UNIT_MANAGER,
                is_active=True,
            ).count(),
            "unit_media_count": UserProfile.objects.filter(
                role=UserProfile.Role.UNIT_MEDIA,
                is_active=True,
            ).count(),
            "parents_count": UserProfile.objects.filter(
                role=UserProfile.Role.PARENT,
                is_active=True,
            ).count(),
            "content_total": content_status["total"],
            "published_total": content_status["published_total"],
            "pending_review_total": content_status["pending_review_total"],
        }

        cards = [
            {
                "key": "units",
                "label": "واحدهای فعال",
                "value": stats["units_count"],
                "description": None,
            },
            {
                "key": "active_users",
                "label": "کاربران فعال",
                "value": stats["active_users_count"],
                "description": None,
            },
            {
                "key": "content_total",
                "label": "کل محتوا",
                "value": stats["content_total"],
                "description": "خبر، اطلاعیه و گالری",
            },
            {
                "key": "pending_review",
                "label": "در انتظار بررسی",
                "value": stats["pending_review_total"],
                "description": None,
            },
            {
                "key": "published",
                "label": "منتشرشده",
                "value": stats["published_total"],
                "description": None,
            },
        ]
        active_units_queryset = SchoolUnit.objects.filter(is_active=True)

        return Response(
            {
                "role": UserProfile.Role.GENERAL_MANAGER,
                "scope": "all",
                "selected_unit": None,
                "accessible_units": [
                    unit_payload(unit)
                    for unit in active_units_queryset.order_by("order", "id")
                ],
                "stats": stats,
                "cards": cards,
                "content_status": content_status,
                "recent_activity": latest_activity(
                    news_queryset=news_queryset,
                    announcement_queryset=announcement_queryset,
                    gallery_queryset=gallery_queryset,
                ),
                "current_date": timezone.now().isoformat(),
                "metrics": frontend_metrics(cards),
                "messages": message_feed(request.user),
                "events": event_feed(Event.objects.filter(is_active=True)),
                "announcements": announcement_feed(announcement_queryset),
                "units": unit_performance_feed(active_units_queryset),
            }
        )


class UnitManagerDashboardAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]

    @extend_schema(
        tags=["Dashboard"],
        summary="Unit manager dashboard",
        responses=DashboardResponseSerializer,
    )
    def get(self, request):
        if not (user_is_general_manager(request.user) or user_is_unit_manager(request.user)):
            raise PermissionDenied("شما اجازه دسترسی به داشبورد مدیر واحد را ندارید.")

        selected_unit, accessible_units = resolve_selected_unit(
            request=request,
            allowed_roles=(
                UserUnitMembership.UnitRole.UNIT_MANAGER,
            ),
        )

        if selected_unit is None:
            raise PermissionDenied("هیچ واحد فعالی برای شما تعریف نشده است.")

        news_queryset = News.objects.select_related("unit").filter(
            scope=News.Scope.UNIT,
            unit=selected_unit,
        )
        announcement_queryset = Announcement.objects.select_related("unit").filter(
            scope=Announcement.Scope.UNIT,
            unit=selected_unit,
        )
        gallery_queryset = GalleryItem.objects.select_related("unit").filter(
            scope=GalleryItem.Scope.UNIT,
            unit=selected_unit,
        )

        content_status = content_status_payload(
            news_queryset=news_queryset,
            announcement_queryset=announcement_queryset,
            gallery_queryset=gallery_queryset,
        )

        stats = {
            "unit_id": selected_unit.id,
            "content_total": content_status["total"],
            "published_total": content_status["published_total"],
            "pending_review_total": content_status["pending_review_total"],
            "news_total": content_status["news"]["total"],
            "announcements_total": content_status["announcements"]["total"],
            "gallery_total": content_status["gallery"]["total"],
        }

        cards = [
            {
                "key": "content_total",
                "label": "محتوای واحد",
                "value": stats["content_total"],
                "description": selected_unit.title,
            },
            {
                "key": "pending_review",
                "label": "در انتظار بررسی",
                "value": stats["pending_review_total"],
                "description": None,
            },
            {
                "key": "published",
                "label": "منتشرشده",
                "value": stats["published_total"],
                "description": None,
            },
            {
                "key": "gallery",
                "label": "گالری",
                "value": stats["gallery_total"],
                "description": None,
            },
        ]

        return Response(
            {
                "role": UserProfile.Role.UNIT_MANAGER,
                "scope": "unit",
                "selected_unit": unit_payload(selected_unit),
                "accessible_units": accessible_units,
                "stats": stats,
                "cards": cards,
                "content_status": content_status,
                "recent_activity": latest_activity(
                    news_queryset=news_queryset,
                    announcement_queryset=announcement_queryset,
                    gallery_queryset=gallery_queryset,
                ),
            }
        )


class MediaDashboardAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]

    @extend_schema(
        tags=["Dashboard"],
        summary="Media dashboard",
        responses=DashboardResponseSerializer,
    )
    def get(self, request):
        if not (
            user_is_general_manager(request.user)
            or user_is_unit_manager(request.user)
            or user_is_unit_media(request.user)
        ):
            raise PermissionDenied("شما اجازه دسترسی به داشبورد رسانه را ندارید.")

        if user_is_unit_media(request.user):
            allowed_roles = (
                UserUnitMembership.UnitRole.UNIT_MEDIA,
            )
        else:
            allowed_roles = (
                UserUnitMembership.UnitRole.UNIT_MANAGER,
                UserUnitMembership.UnitRole.UNIT_MEDIA,
            )

        selected_unit, accessible_units = resolve_selected_unit(
            request=request,
            allowed_roles=allowed_roles,
        )

        if selected_unit is None:
            raise PermissionDenied("هیچ واحد فعالی برای شما تعریف نشده است.")

        gallery_queryset = GalleryItem.objects.select_related("unit").filter(
            scope=GalleryItem.Scope.UNIT,
            unit=selected_unit,
        )

        gallery_counts = status_counts(gallery_queryset, GalleryItem)

        stats = {
            "unit_id": selected_unit.id,
            "gallery_total": gallery_counts["total"],
            "gallery_draft": gallery_counts.get(GalleryItem.Status.DRAFT, 0),
            "gallery_waiting_review": gallery_counts.get(GalleryItem.Status.WAITING_REVIEW, 0),
            "gallery_approved": gallery_counts.get(GalleryItem.Status.APPROVED, 0),
            "gallery_published": gallery_counts.get(GalleryItem.Status.PUBLISHED, 0),
            "gallery_rejected": gallery_counts.get(GalleryItem.Status.REJECTED, 0),
            "gallery_archived": gallery_counts.get(GalleryItem.Status.ARCHIVED, 0),
        }

        cards = [
            {
                "key": "gallery_total",
                "label": "کل آیتم‌های گالری",
                "value": stats["gallery_total"],
                "description": selected_unit.title,
            },
            {
                "key": "gallery_draft",
                "label": "پیش‌نویس",
                "value": stats["gallery_draft"],
                "description": None,
            },
            {
                "key": "gallery_waiting_review",
                "label": "در انتظار بررسی",
                "value": stats["gallery_waiting_review"],
                "description": None,
            },
            {
                "key": "gallery_published",
                "label": "منتشرشده",
                "value": stats["gallery_published"],
                "description": None,
            },
        ]

        return Response(
            {
                "role": UserProfile.Role.UNIT_MEDIA,
                "scope": "unit",
                "selected_unit": unit_payload(selected_unit),
                "accessible_units": accessible_units,
                "stats": stats,
                "cards": cards,
                "content_status": {
                    "gallery": gallery_counts,
                },
                "recent_activity": latest_activity(
                    news_queryset=News.objects.none(),
                    announcement_queryset=Announcement.objects.none(),
                    gallery_queryset=gallery_queryset,
                ),
            }
        )


class ParentsDashboardAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]

    @extend_schema(
        tags=["Dashboard"],
        summary="Parents dashboard",
        responses=DashboardResponseSerializer,
    )
    def get(self, request):
        if not user_is_parent(request.user):
            raise PermissionDenied("شما اجازه دسترسی به داشبورد والدین را ندارید.")

        return Response(
            {
                "role": UserProfile.Role.PARENT,
                "scope": "parent",
                "selected_unit": None,
                "accessible_units": get_user_units_payload(request.user),
                "profile": profile_payload(request.user),
                "stats": {
                    "accessible_units_count": len(get_user_units_payload(request.user)),
                },
                "cards": [
                    {
                        "key": "accessible_units",
                        "label": "واحدهای مرتبط",
                        "value": len(get_user_units_payload(request.user)),
                        "description": None,
                    },
                ],
                "content_status": {},
                "recent_activity": [],
            }
        )
