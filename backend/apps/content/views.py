from datetime import date

from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.announcements.models import Announcement
from apps.core.pagination import StandardResultsSetPagination
from apps.news.models import News
from apps.events.models import Event

from .serializers import (
    ContentAggregateItemSerializer,
    ContentAggregateQuerySerializer,
)


PUBLISHED_STATUS = "published"
SCHOOL_SCOPE = "school"
UNIT_SCOPE = "unit"


def build_absolute_file_url(request, file_field):
    if not file_field:
        return None

    try:
        url = file_field.url
    except ValueError:
        return None

    return request.build_absolute_uri(url)


def unit_payload(unit):
    if unit is None:
        return None

    return {
        "id": unit.id,
        "title": unit.title,
        "slug": unit.slug,
    }


def category_payload(category):
    if category is None:
        return None

    return {
        "title": category.title,
        "slug": category.slug,
    }

def event_content_payload(request, event):
    image_url = build_absolute_file_url(request, event.cover_image)

    unit = None

    if event.unit_id:
        unit = {
            "id": event.unit.id,
            "title": event.unit.title,
            "slug": event.unit.slug,
        }

    return {
        "id": event.id,
        "type": "event",
        "title": event.title,
        "slug": event.slug,
        "summary": event.summary,
        "description": event.description,
        "cover_image": image_url,
        "image": image_url,
        "published_at": event.published_at,
        "category": None,
        "scope": event.scope,
        "unit_id": event.unit_id,
        "unit": unit,
        "status": event.status,
        "is_featured": event.is_featured,
        "detail_url": f"/api/events/{event.slug}/",
        "event_start_at": event.event_start_at,
        "event_end_at": event.event_end_at,
        "location": event.location,
        "registration_url": event.registration_url,
        "_content_text": event.description or "",
    }

def news_to_content_item(request, news: News) -> dict:
    return {
        "type": "news",
        "id": news.id,
        "title": news.title,
        "slug": news.slug,
        "summary": news.summary,
        "cover_image": build_absolute_file_url(request, news.cover_image),
        "published_at": news.published_at,
        "category": category_payload(news.category),
        "scope": news.scope,
        "unit": unit_payload(news.unit),
        "status": news.status,
        "is_featured": news.is_featured,
        "detail_url": f"/api/news/{news.slug}/",
        "_content_text": news.content_text or "",
    }


def announcement_to_content_item(request, announcement: Announcement) -> dict:
    return {
        "type": "announcement",
        "id": announcement.id,
        "title": announcement.title,
        "slug": announcement.slug,
        "summary": announcement.summary,
        "cover_image": build_absolute_file_url(request, announcement.cover_image),
        "published_at": announcement.published_at,
        "category": category_payload(announcement.category),
        "scope": announcement.scope,
        "unit": unit_payload(announcement.unit),
        "status": announcement.status,
        "is_featured": announcement.is_featured,
        "detail_url": f"/api/announcements/{announcement.slug}/",
        "_content_text": announcement.content_text or "",
    }


def sort_content_items(items: list[dict], ordering: str) -> list[dict]:
    reverse = ordering.startswith("-")
    field = ordering.lstrip("-")

    if field == "title":
        return sorted(
            items,
            key=lambda item: (
                item.get("title") or "",
                item.get("type") or "",
                item.get("id") or 0,
            ),
            reverse=reverse,
        )

    return sorted(
        items,
        key=lambda item: (
            item.get("published_at") or date.min,
            item.get("id") or 0,
        ),
        reverse=reverse,
    )


def clean_internal_fields(items: list[dict]) -> list[dict]:
    cleaned_items = []

    for item in items:
        item = dict(item)
        item.pop("_content_text", None)
        cleaned_items.append(item)

    return cleaned_items


class ContentAggregateAPIView(APIView):
    permission_classes = [AllowAny]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=["Content"],
        summary="Aggregate published public content from news, announcements, gallery, and events",        parameters=[
            OpenApiParameter(
                name="type",
                description="Content type. Accepted values: all, news, announcement, event.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="scope",
                description="Filter by scope. Accepted values: school, unit.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="unit_id",
                description="Required when scope=unit.",
                required=False,
                type=int,
            ),
            OpenApiParameter(
                name="status",
                description="Public aggregate API only returns published content. Non-published status returns empty result.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="category",
                description="Filter by category slug.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="search",
                description="Search in title, summary, content text, category title, and unit title.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="featured",
                description="Filter featured content. Accepted values: true, false.",
                required=False,
                type=bool,
            ),
            OpenApiParameter(
                name="ordering",
                description="Allowed: published_at, -published_at, title, -title.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="page",
                description="Page number for paginated results.",
                required=False,
                type=int,
            ),
        ],
        responses=ContentAggregateItemSerializer(many=True),
    )
    def get(self, request):
        query_serializer = ContentAggregateQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)

        params = query_serializer.validated_data

        if params.get("status", PUBLISHED_STATUS) != PUBLISHED_STATUS:
            return self._paginated_response(request, [])

        content_type = params.get("type", "all")
        ordering = params.get("ordering", "-published_at")

        items: list[dict] = []

        if content_type in ("all", "news"):
            news_items = [
                news_to_content_item(request, news)
                for news in self._get_news_queryset()
            ]
            items.extend(news_items)

        if content_type in ("all", "announcement"):
            announcement_items = [
                announcement_to_content_item(request, announcement)
                for announcement in self._get_announcement_queryset()
            ]
            items.extend(announcement_items)
            
        if content_type in ("all", "event"):
            event_items = [
                event_content_payload(request, event)
                for event in self._get_event_queryset()
            ]
            items.extend(event_items)

        items = self._apply_common_filters(items, params)
        items = sort_content_items(items, ordering)
        items = clean_internal_fields(items)

        return self._paginated_response(request, items)

    def _paginated_response(self, request, items):
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(items, request, view=self)

        serializer = ContentAggregateItemSerializer(
            page,
            many=True,
            context={
                "request": request,
            },
        )

        return paginator.get_paginated_response(serializer.data)

    def _get_news_queryset(self):
        today = timezone.localdate()

        return (
            News.objects.select_related("category", "unit")
            .filter(
                is_active=True,
                status=PUBLISHED_STATUS,
                published_at__isnull=False,
                published_at__lte=today,
            )
            .order_by("-published_at", "-id")
        )

    def _get_announcement_queryset(self):
        today = timezone.localdate()

        return (
            Announcement.objects.select_related("category", "unit")
            .filter(
                is_active=True,
                status=PUBLISHED_STATUS,
                published_at__isnull=False,
                published_at__lte=today,
            )
            .order_by("-published_at", "-id")
        )

    def _get_event_queryset(self):
        today = timezone.localdate()

        return (
            Event.objects.select_related("unit")
            .filter(
                is_active=True,
                status=PUBLISHED_STATUS,
                published_at__isnull=False,
                published_at__lte=today,
            )
            .exclude(
                unit__isnull=False,
                unit__is_active=False,
            )
            .order_by("-published_at", "-id")
        )

    def _apply_common_filters(self, items: list[dict], params: dict) -> list[dict]:
        filtered_items = []

        for item in items:
            if not self._is_public_item(item):
                continue

            if not self._matches_scope(item, params):
                continue

            if not self._matches_category(item, params):
                continue

            if not self._matches_search(item, params):
                continue

            if not self._matches_featured(item, params):
                continue

            filtered_items.append(item)

        return filtered_items

    def _is_public_item(self, item: dict) -> bool:
        category = item.get("category")
        unit = item.get("unit")

        # category و unit در payload فقط وقتی وجود دارند که object اصلی وجود داشته باشد.
        # inactive بودن آن‌ها قبل از payload باید از object واقعی بررسی شود.
        # برای همین active check را در queryset base به شکل join اجباری انجام نمی‌دهیم.
        # مدل‌های News و Announcement در زمان publish هم inactive category/unit را reject می‌کنند.
        return item.get("status") == PUBLISHED_STATUS

    def _matches_scope(self, item: dict, params: dict) -> bool:
        scope = params.get("scope")
        unit_id = params.get("unit_id")

        if scope == SCHOOL_SCOPE:
            return item.get("scope") == SCHOOL_SCOPE and item.get("unit") is None

        if scope == UNIT_SCOPE:
            if not unit_id:
                return False

            unit = item.get("unit")

            return (
                item.get("scope") == UNIT_SCOPE
                and unit is not None
                and unit.get("id") == unit_id
            )

        if unit_id:
            unit = item.get("unit")

            return (
                item.get("scope") == UNIT_SCOPE
                and unit is not None
                and unit.get("id") == unit_id
            )

        return True

    def _matches_category(self, item: dict, params: dict) -> bool:
        category_slug = params.get("category")

        if not category_slug:
            return True

        category = item.get("category")

        if category is None:
            return False

        return category.get("slug") == category_slug

    def _matches_search(self, item: dict, params: dict) -> bool:
        search = params.get("search")

        if not search:
            return True

        search = search.strip().lower()

        if not search:
            return True

        category = item.get("category") or {}
        unit = item.get("unit") or {}

        searchable_text = " ".join(
            [
                str(item.get("title") or ""),
                str(item.get("summary") or ""),
                str(item.get("_content_text") or ""),
                str(category.get("title") or ""),
                str(category.get("slug") or ""),
                str(unit.get("title") or ""),
                str(unit.get("slug") or ""),
            ]
        ).lower()

        return search in searchable_text

    def _matches_featured(self, item: dict, params: dict) -> bool:
        featured = params.get("featured", None)

        if featured is None:
            return True

        return item.get("is_featured") is featured