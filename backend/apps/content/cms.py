from html import escape
from datetime import datetime

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers
from rest_framework.viewsets import GenericViewSet

from apps.accounts.models import UserProfile
from apps.accounts.selectors import get_or_create_user_profile
from apps.announcements.models import Announcement, AnnouncementCategory
from apps.news.models import News, NewsCategory
from apps.news.permissions import get_accessible_unit_ids, is_general_manager
from apps.units.models import SchoolUnit


CONTENT_MODELS = {
    "news": (News, NewsCategory),
    "announcement": (Announcement, AnnouncementCategory),
}


class FrontendContentSerializer(serializers.Serializer):
    id = serializers.CharField()
    kind = serializers.ChoiceField(choices=("news", "announcement"))
    title = serializers.CharField()
    slug = serializers.CharField()
    summary = serializers.CharField(allow_null=True, required=False)
    body_html = serializers.CharField(allow_blank=True)
    cover_image = serializers.CharField(allow_null=True, required=False)
    scope = serializers.ChoiceField(choices=("school", "unit"))
    unit_id = serializers.IntegerField(allow_null=True)
    category = serializers.CharField(allow_null=True, required=False)
    status = serializers.CharField()
    author_role = serializers.CharField(allow_null=True, required=False)
    published_at = serializers.DateField(allow_null=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


def _absolute_file_or_fallback(request, file_field, fallback):
    if file_field:
        try:
            return request.build_absolute_uri(file_field.url)
        except (ValueError, AttributeError):
            pass
    return fallback or None


def _editorjs_to_html(content_json):
    if not isinstance(content_json, dict):
        return ""

    fragments = []
    for block in content_json.get("blocks") or []:
        if not isinstance(block, dict):
            continue
        block_type = block.get("type")
        data = block.get("data") or {}
        if not isinstance(data, dict):
            continue

        if block_type == "paragraph":
            fragments.append(str(data.get("text") or ""))
        elif block_type == "header":
            level = data.get("level", 2)
            level = level if level in (1, 2, 3, 4, 5, 6) else 2
            fragments.append(f"<h{level}>{data.get('text') or ''}</h{level}>")
        elif block_type in ("quote", "qoute"):
            fragments.append(f"<blockquote>{data.get('text') or ''}</blockquote>")
        elif block_type == "list":
            tag = "ol" if data.get("style") == "ordered" else "ul"
            items = "".join(f"<li>{item}</li>" for item in (data.get("items") or []))
            fragments.append(f"<{tag}>{items}</{tag}>")
        elif block_type == "delimiter":
            fragments.append("<hr>")
        elif block_type == "image":
            file_data = data.get("file") or {}
            url = file_data.get("url") if isinstance(file_data, dict) else None
            if url:
                caption = escape(str(data.get("caption") or ""), quote=True)
                fragments.append(f'<img src="{escape(str(url), quote=True)}" alt="{caption}">')

    return "\n".join(fragments)


def _html_to_editorjs(body_html):
    return {
        "time": None,
        "version": "frontend-html-compat",
        "blocks": [
            {
                "type": "paragraph",
                "data": {"text": body_html or ""},
            }
        ],
    }


def _content_id(kind, object_id):
    return f"{kind}-{object_id}"


def _parse_content_id(value):
    value = str(value)
    for kind in CONTENT_MODELS:
        prefix = f"{kind}-"
        if value.startswith(prefix) and value[len(prefix):].isdigit():
            return kind, int(value[len(prefix):])
    raise NotFound("محتوا یافت نشد.")


def _category_title(category):
    return category.title if category else None


def _author_role(item):
    if not item.created_by_id:
        return None
    profile = getattr(item.created_by, "profile", None)
    return profile.role if profile else None


def serialize_content_item(request, kind, item):
    return {
        "id": _content_id(kind, item.id),
        "kind": kind,
        "title": item.title,
        "slug": item.slug,
        "summary": item.summary,
        "body_html": _editorjs_to_html(item.content_json),
        "cover_image": _absolute_file_or_fallback(
            request,
            item.cover_image,
            item.cover_image_url,
        ),
        "scope": item.scope,
        "unit_id": item.unit_id,
        "category": _category_title(item.category),
        "status": item.status,
        "author_role": _author_role(item),
        "published_at": item.published_at,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


class CMSContentViewSet(GenericViewSet):
    """Compatibility CRUD API for the frontend's unified content repository."""

    serializer_class = FrontendContentSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAuthenticated()]

    def list(self, request):
        items = []
        for kind, (model, _) in CONTENT_MODELS.items():
            queryset = self._visible_queryset(request.user, model)
            items.extend(
                serialize_content_item(request, kind, item)
                for item in queryset.select_related("category", "unit", "created_by__profile")
            )

        items.sort(key=lambda item: item["updated_at"], reverse=True)
        return Response(items)

    def retrieve(self, request, pk=None):
        kind, object_id = _parse_content_id(pk)
        model, _ = CONTENT_MODELS[kind]
        item = self._visible_queryset(request.user, model).filter(pk=object_id).first()
        if item is None:
            raise NotFound("محتوا یافت نشد.")
        return Response(serialize_content_item(request, kind, item))

    def create(self, request):
        kind = request.data.get("kind")
        if kind not in CONTENT_MODELS:
            raise ValidationError({"kind": "نوع محتوا باید news یا announcement باشد."})

        model, category_model = CONTENT_MODELS[kind]
        values = self._validated_values(request, model, category_model)
        try:
            item = model.objects.create(
                **values,
                created_by=request.user,
                updated_by=request.user,
                published_by=request.user if values["status"] == model.Status.PUBLISHED else None,
            )
        except DjangoValidationError as exc:
            self._raise_validation(exc)

        return Response(
            serialize_content_item(request, kind, item),
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, pk=None):
        return self._update(request, pk, partial=False)

    def partial_update(self, request, pk=None):
        return self._update(request, pk, partial=True)

    def destroy(self, request, pk=None):
        kind, object_id = _parse_content_id(pk)
        model, _ = CONTENT_MODELS[kind]
        item = model.objects.filter(pk=object_id).first()
        if item is None:
            raise NotFound("محتوا یافت نشد.")
        self._ensure_write_access(request.user, item.scope, item.unit_id)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _update(self, request, pk, partial):
        kind, object_id = _parse_content_id(pk)
        model, category_model = CONTENT_MODELS[kind]
        item = model.objects.filter(pk=object_id).first()
        if item is None:
            raise NotFound("محتوا یافت نشد.")

        values = self._validated_values(
            request,
            model,
            category_model,
            instance=item,
            partial=partial,
        )
        for field_name, value in values.items():
            setattr(item, field_name, value)
        item.updated_by = request.user
        if item.status == model.Status.PUBLISHED and not item.published_by_id:
            item.published_by = request.user

        try:
            item.save()
        except DjangoValidationError as exc:
            self._raise_validation(exc)

        return Response(serialize_content_item(request, kind, item))

    def _visible_queryset(self, user, model):
        queryset = model.objects.all()
        today = timezone.localdate()

        if not user or not user.is_authenticated:
            return queryset.filter(
                is_active=True,
                status=model.Status.PUBLISHED,
                published_at__isnull=False,
                published_at__lte=today,
            )

        if is_general_manager(user):
            return queryset

        profile = get_or_create_user_profile(user)
        accessible_unit_ids = get_accessible_unit_ids(user)
        if profile.role in (UserProfile.Role.UNIT_MANAGER, UserProfile.Role.UNIT_MEDIA):
            return queryset.filter(
                Q(
                    is_active=True,
                    status=model.Status.PUBLISHED,
                    scope=model.Scope.SCHOOL,
                    published_at__lte=today,
                )
                | Q(scope=model.Scope.UNIT, unit_id__in=accessible_unit_ids)
            ).distinct()

        return queryset.filter(
            is_active=True,
            status=model.Status.PUBLISHED,
            published_at__isnull=False,
            published_at__lte=today,
        )

    def _validated_values(self, request, model, category_model, instance=None, partial=False):
        data = request.data

        def current(name, default=None):
            return getattr(instance, name, default) if instance is not None else default

        required = ("title", "body_html") if instance is None and not partial else ()
        errors = {name: "این فیلد الزامی است." for name in required if name not in data}
        if errors:
            raise ValidationError(errors)

        scope = data.get("scope", current("scope", model.Scope.SCHOOL))
        unit_id = data.get("unit_id", current("unit_id"))
        if unit_id in ("", None):
            unit_id = None
        else:
            try:
                unit_id = int(unit_id)
            except (TypeError, ValueError):
                raise ValidationError({"unit_id": "شناسه واحد معتبر نیست."})

        if scope == model.Scope.UNIT and unit_id is None and not is_general_manager(request.user):
            accessible_unit_ids = get_accessible_unit_ids(request.user)
            if len(accessible_unit_ids) == 1:
                unit_id = accessible_unit_ids[0]

        self._ensure_write_access(request.user, scope, unit_id)

        status_value = data.get("status", current("status", model.Status.DRAFT))
        valid_statuses = {choice for choice, _ in model.Status.choices}
        if status_value not in valid_statuses:
            raise ValidationError({"status": "وضعیت محتوا معتبر نیست."})
        if not is_general_manager(request.user) and status_value in (
            model.Status.APPROVED,
            model.Status.PUBLISHED,
            model.Status.ARCHIVED,
        ):
            status_value = model.Status.WAITING_REVIEW

        published_at = data.get("published_at", current("published_at"))
        if isinstance(published_at, str):
            try:
                published_at = datetime.fromisoformat(
                    published_at.replace("Z", "+00:00")
                ).date()
            except ValueError:
                raise ValidationError({"published_at": "تاریخ انتشار معتبر نیست."})
        if status_value == model.Status.PUBLISHED and published_at is None:
            published_at = timezone.localdate()

        category_value = data.get("category", None)
        if "category" in data:
            if isinstance(category_value, dict):
                category_value = category_value.get("title")
            category_value = str(category_value).strip() if category_value else ""
            category = None
            if category_value:
                category = category_model.objects.filter(title=category_value).first()
                if category is None:
                    category = category_model.objects.create(title=category_value)
        else:
            category = current("category")

        title = data.get("title", current("title", ""))
        summary = data.get("summary", current("summary"))
        if status_value == model.Status.PUBLISHED and not summary:
            summary = title

        body_html = data.get("body_html")
        content_json = (
            _html_to_editorjs(body_html)
            if "body_html" in data
            else current("content_json", _html_to_editorjs(""))
        )

        cover_value = data.get("cover_image", None)
        cover_image_url = current("cover_image_url")
        cover_image = current("cover_image")
        if "cover_image" in data:
            if isinstance(cover_value, str):
                cover_image_url = cover_value.strip() or None
                cover_image = None
            elif cover_value is None:
                cover_image_url = None
                cover_image = None

        values = {
            "title": title,
            "slug": data.get("slug", current("slug", "")),
            "summary": summary,
            "content_json": content_json,
            "scope": scope,
            "unit_id": unit_id,
            "category": category,
            "status": status_value,
            "published_at": published_at,
            "cover_image": cover_image,
            "cover_image_url": cover_image_url,
            "is_active": True,
        }
        return values

    def _ensure_write_access(self, user, scope, unit_id):
        if is_general_manager(user):
            return
        if not user or not user.is_authenticated:
            raise PermissionDenied("ورود به حساب کاربری الزامی است.")

        profile = get_or_create_user_profile(user)
        if profile.role not in (UserProfile.Role.UNIT_MANAGER, UserProfile.Role.UNIT_MEDIA):
            raise PermissionDenied("اجازه مدیریت محتوا را ندارید.")
        if scope != "unit" or unit_id not in get_accessible_unit_ids(user):
            raise PermissionDenied("فقط محتوای واحدهای مجاز قابل مدیریت است.")

    @staticmethod
    def _raise_validation(exc):
        if hasattr(exc, "message_dict"):
            raise ValidationError(exc.message_dict)
        raise ValidationError(exc.messages)
