from datetime import datetime, timedelta
from html import escape

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers
from rest_framework.viewsets import GenericViewSet

from apps.accounts.models import UserProfile
from apps.accounts.selectors import get_or_create_user_profile
from apps.announcements.models import Announcement, AnnouncementCategory
from apps.core.models import SEOFieldsModel
from apps.news.models import News, NewsCategory
from apps.news.permissions import get_accessible_unit_ids, is_general_manager
from apps.units.models import SchoolUnit

from .models import ContentRevision
from .rich_text import render_tiptap_html


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
    body_json = serializers.JSONField(allow_null=True, required=False)
    cover_image_url = serializers.CharField(allow_null=True, required=False)
    scope = serializers.ChoiceField(choices=("school", "unit"))
    unit_id = serializers.IntegerField(allow_null=True)
    unit = serializers.DictField(allow_null=True, required=False)
    category = serializers.DictField(allow_null=True, required=False)
    status = serializers.CharField()
    author = serializers.DictField(allow_null=True, required=False)
    author_role = serializers.CharField(allow_null=True, required=False)
    scheduled_at = serializers.DateField(allow_null=True, required=False)
    published_at = serializers.DateField(allow_null=True)
    is_featured = serializers.BooleanField(required=False)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    seo = serializers.DictField(required=False)


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

def _inline_tiptap_text(node):
    if not isinstance(node, dict):
        return ""
    if node.get("type") == "text":
        text = escape(str(node.get("text") or ""))
        for mark in node.get("marks") or []:
            mark_type = mark.get("type") if isinstance(mark, dict) else None
            if mark_type == "bold":
                text = f"<strong>{text}</strong>"
            elif mark_type == "italic":
                text = f"<em>{text}</em>"
            elif mark_type == "underline":
                text = f"<u>{text}</u>"
            elif mark_type == "strike":
                text = f"<s>{text}</s>"
            elif mark_type == "link":
                href = escape(str((mark.get("attrs") or {}).get("href") or ""), quote=True)
                text = f'<a href="{href}">{text}</a>'
        return text
    return "".join(_inline_tiptap_text(child) for child in node.get("content") or [])


def _tiptap_list_items(node):
    items = []
    for item in node.get("content") or []:
        if not isinstance(item, dict) or item.get("type") != "listItem":
            continue
        items.append(_inline_tiptap_text(item))
    return items


def _tiptap_to_editorjs(value):
    if not isinstance(value, dict) or value.get("type") != "doc":
        return _html_to_editorjs("")
    blocks = []
    for node in value.get("content") or []:
        if not isinstance(node, dict):
            continue
        node_type = node.get("type")
        if node_type == "paragraph":
            blocks.append({"type": "paragraph", "data": {"text": _inline_tiptap_text(node)}})
        elif node_type == "heading":
            blocks.append(
                {
                    "type": "header",
                    "data": {
                        "text": _inline_tiptap_text(node),
                        "level": (node.get("attrs") or {}).get("level", 2),
                    },
                }
            )
        elif node_type in ("bulletList", "orderedList"):
            blocks.append(
                {
                    "type": "list",
                    "data": {
                        "style": "ordered" if node_type == "orderedList" else "unordered",
                        "items": _tiptap_list_items(node),
                    },
                }
            )
        elif node_type == "blockquote":
            blocks.append(
                {
                    "type": "quote",
                    "data": {"text": _inline_tiptap_text(node), "caption": ""},
                }
            )
        elif node_type == "horizontalRule":
            blocks.append({"type": "delimiter", "data": {}})
        elif node_type == "image":
            attrs = node.get("attrs") or {}
            if attrs.get("src"):
                blocks.append(
                    {
                        "type": "image",
                        "data": {
                            "file": {"url": attrs["src"]},
                            "caption": attrs.get("alt") or attrs.get("title") or "",
                        },
                    }
                )
    return {"time": None, "version": "tiptap-compat-1", "blocks": blocks}


def _editorjs_inline_node(value):
    return [{"type": "text", "text": str(value or "")}] if value else []


def _editorjs_to_tiptap(value):
    content = []
    for block in (value or {}).get("blocks") or []:
        if not isinstance(block, dict):
            continue
        block_type = block.get("type")
        data = block.get("data") or {}
        if block_type == "paragraph":
            content.append({"type": "paragraph", "content": _editorjs_inline_node(data.get("text"))})
        elif block_type == "header":
            content.append(
                {
                    "type": "heading",
                    "attrs": {"level": data.get("level", 2)},
                    "content": _editorjs_inline_node(data.get("text")),
                }
            )
        elif block_type == "list":
            list_type = "orderedList" if data.get("style") == "ordered" else "bulletList"
            content.append(
                {
                    "type": list_type,
                    "content": [
                        {
                            "type": "listItem",
                            "content": [
                                {
                                    "type": "paragraph",
                                    "content": _editorjs_inline_node(item),
                                }
                            ],
                        }
                        for item in data.get("items") or []
                    ],
                }
            )
        elif block_type in ("quote", "qoute"):
            content.append(
                {
                    "type": "blockquote",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": _editorjs_inline_node(data.get("text")),
                        }
                    ],
                }
            )
        elif block_type == "delimiter":
            content.append({"type": "horizontalRule"})
        elif block_type == "image":
            file_data = data.get("file") or {}
            if isinstance(file_data, dict) and file_data.get("url"):
                content.append(
                    {
                        "type": "image",
                        "attrs": {
                            "src": file_data["url"],
                            "alt": data.get("caption") or "",
                            "title": data.get("caption") or "",
                        },
                    }
                )
    return {"type": "doc", "content": content}


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
    today = timezone.localdate()
    serialized_status = (
        "scheduled"
        if item.status == item.Status.PUBLISHED
        and item.published_at
        and item.published_at > today
        else item.status
    )
    body_json = item.editor_json or _editorjs_to_tiptap(item.content_json)
    body_html = (
        render_tiptap_html(item.editor_json)
        if item.editor_json is not None
        else _editorjs_to_html(item.content_json)
    )
    return {
        "id": _content_id(kind, item.id),
        "kind": kind,
        "title": item.title,
        "slug": item.slug,
        "summary": item.summary,
        "body_html": body_html,
        "body_json": body_json,
        "cover_image_url": _absolute_file_or_fallback(
            request,
            item.cover_image,
            item.cover_image_url,
        ),
        "scope": item.scope,
        "unit_id": item.unit_id,
        "category": (
            {"id": item.category_id, "title": item.category.title}
            if item.category_id
            else None
        ),
        "unit": (
            {"id": item.unit_id, "title": item.unit.title}
            if item.unit_id
            else None
        ),
        "status": serialized_status,
        "author": (
            {
                "id": item.created_by_id,
                "full_name": getattr(item.created_by.profile, "full_name", None)
                or item.created_by.get_username(),
                "avatar_url": None,
            }
            if item.created_by_id
            else None
        ),
        "scheduled_at": (
            item.published_at if serialized_status == "scheduled" else None
        ),
        "is_featured": item.is_featured,
        "author_role": _author_role(item),
        "published_at": item.published_at,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "seo": _serialize_seo_fields(item),
    }


def _serialize_seo_fields(item):
    return item.seo_fields_dict()


_SEO_FIELD_NAMES = SEOFieldsModel.SEO_FIELD_NAMES
_SEO_BOOLEAN_FIELDS = ("is_indexable", "is_followable", "is_cornerstone")
_SEO_BOOLEAN_DEFAULTS = {
    "is_indexable": True,
    "is_followable": True,
    "is_cornerstone": False,
}


def _seo_field_default(name):
    return _SEO_BOOLEAN_DEFAULTS[name] if name in _SEO_BOOLEAN_FIELDS else None


def _validated_seo_values(data, current):
    seo_data = data.get("seo")
    if not isinstance(seo_data, dict):
        return {name: current(name, _seo_field_default(name)) for name in _SEO_FIELD_NAMES}

    values = {}
    for name in _SEO_FIELD_NAMES:
        if name not in seo_data:
            values[name] = current(name, _seo_field_default(name))
            continue

        value = seo_data.get(name)
        if name in _SEO_BOOLEAN_FIELDS:
            values[name] = bool(value) if value is not None else _SEO_BOOLEAN_DEFAULTS[name]
        elif isinstance(value, str):
            values[name] = value.strip() or None
        else:
            values[name] = None

    return values


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

        self._record_revision(
            kind,
            item,
            request.user,
            autosave=bool(request.data.get("autosave")),
            note="ایجاد محتوا",
        )

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
        self._ensure_delete_access(request.user, item.scope, item.unit_id)
        ContentRevision.objects.filter(content_kind=kind, object_id=item.id).delete()
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

        self._record_revision(
            kind,
            item,
            request.user,
            autosave=bool(request.data.get("autosave")),
            note="ذخیره خودکار" if request.data.get("autosave") else "ویرایش محتوا",
        )

        return Response(serialize_content_item(request, kind, item))

    def _workflow_item(self, request, pk, review=False):
        kind, object_id = _parse_content_id(pk)
        model, _ = CONTENT_MODELS[kind]
        item = model.objects.filter(pk=object_id).first()
        if item is None:
            raise NotFound("محتوا یافت نشد.")

        if review and not is_general_manager(request.user):
            profile = get_or_create_user_profile(request.user)
            if profile.role != UserProfile.Role.UNIT_MANAGER:
                raise PermissionDenied("اجازه بررسی این محتوا را ندارید.")
            self._ensure_write_access(request.user, item.scope, item.unit_id)
        elif not review:
            self._ensure_write_access(request.user, item.scope, item.unit_id)

        return kind, item

    def _workflow_response(self, request, kind, item, note):
        try:
            item.save()
        except DjangoValidationError as exc:
            self._raise_validation(exc)
        self._record_revision(kind, item, request.user, note=note)
        return Response(serialize_content_item(request, kind, item))

    @action(detail=True, methods=("post",), url_path="submit-review")
    def submit_review(self, request, pk=None):
        kind, item = self._workflow_item(request, pk)
        if item.status not in (item.Status.DRAFT, item.Status.REJECTED):
            raise ValidationError(
                {"status": "فقط پیش‌نویس یا محتوای ردشده قابل ارسال برای بررسی است."}
            )
        item.status = item.Status.WAITING_REVIEW
        item.updated_by = request.user
        return self._workflow_response(request, kind, item, "ارسال برای بررسی")

    @action(detail=True, methods=("post",), url_path="approve")
    def approve(self, request, pk=None):
        kind, item = self._workflow_item(request, pk, review=True)
        if item.status != item.Status.WAITING_REVIEW:
            raise ValidationError(
                {"status": "فقط محتوای در انتظار بررسی قابل تأیید است."}
            )
        item.status = item.Status.APPROVED
        item.updated_by = request.user
        return self._workflow_response(request, kind, item, "تأیید محتوا")

    @action(detail=True, methods=("post",), url_path="reject")
    def reject(self, request, pk=None):
        kind, item = self._workflow_item(request, pk, review=True)
        if item.status not in (item.Status.WAITING_REVIEW, item.Status.APPROVED):
            raise ValidationError(
                {"status": "فقط محتوای در حال بررسی یا تأییدشده قابل رد است."}
            )
        item.status = item.Status.REJECTED
        item.updated_by = request.user
        return self._workflow_response(request, kind, item, "رد محتوا")

    @action(detail=True, methods=("post",), url_path="publish")
    def publish(self, request, pk=None):
        if not is_general_manager(request.user):
            raise PermissionDenied("فقط مدیر کل اجازه انتشار محتوا را دارد.")
        kind, item = self._workflow_item(request, pk)
        if item.status != item.Status.APPROVED:
            raise ValidationError({"status": "فقط محتوای تأییدشده قابل انتشار است."})
        item.status = item.Status.PUBLISHED
        item.published_at = timezone.localdate()
        item.published_by = request.user
        item.updated_by = request.user
        return self._workflow_response(request, kind, item, "انتشار محتوا")

    @action(detail=True, methods=("post",), url_path="schedule")
    def schedule(self, request, pk=None):
        if not is_general_manager(request.user):
            raise PermissionDenied("فقط مدیر کل اجازه زمان‌بندی محتوا را دارد.")
        kind, item = self._workflow_item(request, pk)
        if item.status != item.Status.APPROVED:
            raise ValidationError({"status": "فقط محتوای تأییدشده قابل زمان‌بندی است."})
        scheduled_at = request.data.get("scheduled_at")
        try:
            scheduled_date = datetime.fromisoformat(
                str(scheduled_at).replace("Z", "+00:00")
            ).date()
        except (TypeError, ValueError):
            raise ValidationError({"scheduled_at": "تاریخ زمان‌بندی معتبر نیست."})
        if scheduled_date <= timezone.localdate():
            raise ValidationError(
                {"scheduled_at": "تاریخ زمان‌بندی باید بعد از امروز باشد."}
            )
        item.status = item.Status.PUBLISHED
        item.published_at = scheduled_date
        item.published_by = request.user
        item.updated_by = request.user
        return self._workflow_response(request, kind, item, "زمان‌بندی انتشار")

    @action(detail=True, methods=("get",), url_path="revisions")
    def revisions(self, request, pk=None):
        kind, object_id = _parse_content_id(pk)
        model, _ = CONTENT_MODELS[kind]
        item = model.objects.filter(pk=object_id).first()
        if item is None:
            raise NotFound("محتوا یافت نشد.")
        self._ensure_write_access(request.user, item.scope, item.unit_id)
        revisions = ContentRevision.objects.filter(
            content_kind=kind,
            object_id=item.id,
        ).select_related("actor__profile")[:50]
        return Response(
            [
                {
                    "id": revision.id,
                    "created_at": revision.created_at,
                    "updated_at": revision.updated_at,
                    "note": revision.note,
                    "actor": (
                        {
                            "id": revision.actor_id,
                            "full_name": getattr(revision.actor.profile, "full_name", None)
                            or revision.actor.get_username(),
                        }
                        if revision.actor_id
                        else None
                    ),
                    "snapshot": revision.snapshot,
                }
                for revision in revisions
            ]
        )

    @action(
        detail=True,
        methods=("post",),
        url_path=r"revisions/(?P<revision_id>[^/.]+)/restore",
    )
    def restore_revision(self, request, pk=None, revision_id=None):
        kind, object_id = _parse_content_id(pk)
        model, category_model = CONTENT_MODELS[kind]
        item = model.objects.filter(pk=object_id).first()
        if item is None:
            raise NotFound("محتوا یافت نشد.")
        self._ensure_write_access(request.user, item.scope, item.unit_id)
        revision = ContentRevision.objects.filter(
            pk=revision_id,
            content_kind=kind,
            object_id=item.id,
        ).first()
        if revision is None:
            raise NotFound("نسخه موردنظر یافت نشد.")

        snapshot = revision.snapshot if isinstance(revision.snapshot, dict) else {}
        scope = snapshot.get("scope", item.scope)
        unit_id = snapshot.get("unit_id", item.unit_id)
        self._ensure_write_access(request.user, scope, unit_id)
        category_id = snapshot.get("category_id")
        category = (
            category_model.objects.filter(pk=category_id).first()
            if category_id is not None
            else None
        )
        for field_name in (
            "title",
            "slug",
            "summary",
            "content_json",
            "editor_json",
            "scope",
            "unit_id",
            "cover_image_url",
            "is_featured",
            "is_active",
        ):
            if field_name in snapshot:
                setattr(item, field_name, snapshot[field_name])
        snapshot_seo = snapshot.get("seo")
        if isinstance(snapshot_seo, dict):
            for field_name in _SEO_FIELD_NAMES:
                if field_name in snapshot_seo:
                    setattr(item, field_name, snapshot_seo[field_name])
        item.category = category
        if is_general_manager(request.user):
            item.status = snapshot.get("status", item.status)
            published_at = snapshot.get("published_at")
            item.published_at = (
                datetime.fromisoformat(published_at).date()
                if isinstance(published_at, str) and published_at
                else None
            )
            if item.status == item.Status.PUBLISHED:
                item.published_by = request.user
        item.updated_by = request.user
        try:
            item.save()
        except DjangoValidationError as exc:
            self._raise_validation(exc)
        self._record_revision(kind, item, request.user, note="بازگردانی نسخه")
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
        if status_value == "scheduled":
            status_value = model.Status.PUBLISHED
        valid_statuses = {choice for choice, _ in model.Status.choices}
        if status_value not in valid_statuses:
            raise ValidationError({"status": "وضعیت محتوا معتبر نیست."})
        if "status" in data and not is_general_manager(request.user) and status_value in (
            model.Status.APPROVED,
            model.Status.PUBLISHED,
            model.Status.ARCHIVED,
        ):
            status_value = model.Status.WAITING_REVIEW

        previous_status = current("status", None)
        if instance is None:
            if status_value not in (model.Status.DRAFT, model.Status.WAITING_REVIEW):
                raise ValidationError(
                    {"status": "محتوای جدید باید ابتدا به‌صورت پیش‌نویس یا در انتظار بررسی ثبت شود."}
                )
        elif "status" in data and status_value != previous_status:
            allowed_transitions = {
                model.Status.DRAFT: {model.Status.WAITING_REVIEW},
                model.Status.WAITING_REVIEW: {
                    model.Status.APPROVED,
                    model.Status.REJECTED,
                },
                model.Status.APPROVED: {
                    model.Status.PUBLISHED,
                    model.Status.REJECTED,
                },
                model.Status.REJECTED: {
                    model.Status.DRAFT,
                    model.Status.WAITING_REVIEW,
                },
                model.Status.PUBLISHED: {model.Status.ARCHIVED},
                model.Status.ARCHIVED: {model.Status.DRAFT},
            }
            if status_value not in allowed_transitions.get(previous_status, set()):
                raise ValidationError(
                    {
                        "status": (
                            f"تغییر وضعیت از {previous_status} به {status_value} مجاز نیست."
                        )
                    }
                )

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
        editor_json = (
            data.get("body_json")
            if "body_json" in data and data.get("body_json") is not None
            else current("editor_json")
        )
        content_json = (
            _tiptap_to_editorjs(editor_json)
            if editor_json is not None
            else _html_to_editorjs(body_html)
            if "body_html" in data
            else current("content_json", _html_to_editorjs(""))
        )

        cover_key = (
            "cover_image_url"
            if "cover_image_url" in data
            else "cover_image"
            if "cover_image" in data
            else None
        )
        cover_value = data.get(cover_key) if cover_key else None
        cover_image_url = current("cover_image_url")
        cover_image = current("cover_image")
        if cover_key:
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
            "editor_json": editor_json,
            "scope": scope,
            "unit_id": unit_id,
            "category": category,
            "status": status_value,
            "published_at": published_at,
            "cover_image": cover_image,
            "cover_image_url": cover_image_url,
            "is_featured": data.get("is_featured", current("is_featured", False)),
            "is_active": True,
            **_validated_seo_values(data, current),
        }
        return values

    @staticmethod
    def _revision_snapshot(kind, item):
        body_json = item.editor_json or _editorjs_to_tiptap(item.content_json)
        body_html = (
            render_tiptap_html(item.editor_json)
            if item.editor_json is not None
            else _editorjs_to_html(item.content_json)
        )
        return {
            "kind": kind,
            "title": item.title,
            "slug": item.slug,
            "summary": item.summary,
            "body_html": body_html,
            "body_json": body_json,
            "content_json": item.content_json,
            "editor_json": item.editor_json,
            "cover_image_url": item.cover_image_url,
            "scope": item.scope,
            "unit_id": item.unit_id,
            "category_id": item.category_id,
            "status": item.status,
            "published_at": item.published_at.isoformat() if item.published_at else None,
            "is_featured": item.is_featured,
            "is_active": item.is_active,
            "seo": _serialize_seo_fields(item),
        }

    def _record_revision(self, kind, item, actor, autosave=False, note=None):
        snapshot = self._revision_snapshot(kind, item)
        if autosave:
            latest = ContentRevision.objects.filter(
                content_kind=kind,
                object_id=item.id,
            ).first()
            if latest and latest.created_at >= timezone.now() - timedelta(seconds=60):
                latest.snapshot = snapshot
                latest.actor = actor
                latest.note = note
                latest.save()
                return latest
        return ContentRevision.objects.create(
            content_kind=kind,
            object_id=item.id,
            snapshot=snapshot,
            actor=actor,
            note=note,
        )

    def _ensure_write_access(self, user, scope, unit_id):
        """Create/edit/submit-for-review access. The media role may author
        its own unit's content but may not delete it — see
        _ensure_delete_access."""
        if is_general_manager(user):
            return
        if not user or not user.is_authenticated:
            raise PermissionDenied("ورود به حساب کاربری الزامی است.")

        profile = get_or_create_user_profile(user)
        if profile.role not in (UserProfile.Role.UNIT_MANAGER, UserProfile.Role.UNIT_MEDIA):
            raise PermissionDenied("اجازه مدیریت محتوا را ندارید.")
        if scope != "unit" or unit_id not in get_accessible_unit_ids(user):
            raise PermissionDenied("فقط محتوای واحدهای مجاز قابل مدیریت است.")

    def _ensure_delete_access(self, user, scope, unit_id):
        """Deletion stays out of the media role's reach even for its own unit."""
        if is_general_manager(user):
            return
        if not user or not user.is_authenticated:
            raise PermissionDenied("ورود به حساب کاربری الزامی است.")

        profile = get_or_create_user_profile(user)
        if profile.role != UserProfile.Role.UNIT_MANAGER:
            raise PermissionDenied("اجازه حذف محتوا را ندارید.")
        if scope != "unit" or unit_id not in get_accessible_unit_ids(user):
            raise PermissionDenied("فقط محتوای واحدهای مجاز قابل حذف است.")

    @staticmethod
    def _raise_validation(exc):
        if hasattr(exc, "message_dict"):
            raise ValidationError(exc.message_dict)
        raise ValidationError(exc.messages)
