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


class ContentAggregateAPIView(APIView):
    permission_classes = [AllowAny]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=["Content"],
        summary="Aggregate published public content from news and announcements",
        parameters=[
            OpenApiParameter(
                name="type",
                description="Content type. Accepted values: all, news, announcement.",
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
            news_queryset = self._get_news_queryset(params)
            items.extend(
                news_to_content_item(request, news)
                for news in news_queryset
            )

        if content_type in ("all", "announcement"):
            announcement_queryset = self._get_announcement_queryset(params)
            items.extend(
                announcement_to_content_item(request, announcement)
                for announcement in announcement_queryset
            )

        items = sort_content_items(items, ordering)

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

    def _get_news_queryset(self, params):
        today = timezone.localdate()

        queryset = (
            News.objects.select_related("category", "unit")
            .filter(
                is_active=True,
                status=PUBLISHED_STATUS,
                published_at__isnull=False,
                published_at__lte=today,
            )
            .exclude(
                category__isnull=False,
                category__is_active=False,
            )
            .exclude(
                unit__isnull=False,
                unit__is_active=False,
            )
            .order_by("-published_at", "-id")
        )

        return self._apply_common_filters(
            queryset=queryset,
            params=params,
        )

    def _get_announcement_queryset(self, params):
        today = timezone.localdate()

        queryset = (
            Announcement.objects.select_related("category", "unit")
            .filter(
                is_active=True,
                status=PUBLISHED_STATUS,
                published_at__isnull=False,
                published_at__lte=today,
            )
            .exclude(
                category__isnull=False,
                category__is_active=False,
            )
            .exclude(
                unit__isnull=False,
                unit__is_active=False,
            )
            .order_by("-published_at", "-id")
        )

        return self._apply_common_filters(
            queryset=queryset,
            params=params,
        )

    def _apply_common_filters(self, queryset, params):
        scope = params.get("scope")
        unit_id = params.get("unit_id")

        if scope == SCHOOL_SCOPE:
            queryset = queryset.filter(
                scope=SCHOOL_SCOPE,
                unit__isnull=True,
            )

        elif scope == UNIT_SCOPE:
            if not unit_id:
                return queryset.none()

            queryset = queryset.filter(
                scope=UNIT_SCOPE,
                unit_id=unit_id,
            )

        elif unit_id:
            queryset = queryset.filter(
                scope=UNIT_SCOPE,
                unit_id=unit_id,
            )

        category_slug = params.get("category")

        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)

        search = params.get("search")

        if search:
            search = search.strip()

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(summary__icontains=search)
                | Q(content_text__icontains=search)
                | Q(category__title__icontains=search)
                | Q(unit__title__icontains=search)
            )

        featured = params.get("featured", None)

        if featured is not None:
            queryset = queryset.filter(is_featured=featured)

        return queryset