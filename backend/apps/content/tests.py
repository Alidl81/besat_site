from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.announcements.models import Announcement, AnnouncementCategory
from apps.gallery.models import GalleryItem
from apps.news.models import News, NewsCategory
from apps.units.models import SchoolUnit

from .models import ContentRevision


User = get_user_model()


def valid_content_json(text="متن تست"):
    return {
        "time": None,
        "blocks": [
            {
                "type": "paragraph",
                "data": {
                    "text": text,
                },
            }
        ],
        "version": None,
    }


class ContentAggregateAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.today = timezone.localdate()

        self.unit = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            is_active=True,
        )

        self.news_category = NewsCategory.objects.create(
            title="اخبار",
            slug="news",
            is_active=True,
        )

        self.announcement_category = AnnouncementCategory.objects.create(
            title="اطلاعیه‌ها",
            slug="announcements",
            is_active=True,
        )

        self.school_news = News.objects.create(
            title="خبر عمومی مدرسه",
            slug="school-news",
            summary="خلاصه خبر عمومی",
            category=self.news_category,
            scope=News.Scope.SCHOOL,
            unit=None,
            status=News.Status.PUBLISHED,
            published_at=self.today,
            is_active=True,
            is_featured=True,
            content_json=valid_content_json("ثبت نام خبر عمومی"),
        )

        self.unit_news = News.objects.create(
            title="خبر واحد دبستان",
            slug="unit-news",
            summary="خلاصه خبر واحد",
            category=self.news_category,
            scope=News.Scope.UNIT,
            unit=self.unit,
            status=News.Status.PUBLISHED,
            published_at=self.today - timedelta(days=1),
            is_active=True,
            is_featured=False,
            content_json=valid_content_json("اردوی دانش آموزان دبستان"),
        )

        self.school_announcement = Announcement.objects.create(
            title="اطلاعیه عمومی مدرسه",
            slug="school-announcement",
            summary="خلاصه اطلاعیه عمومی",
            category=self.announcement_category,
            scope=Announcement.Scope.SCHOOL,
            unit=None,
            status=Announcement.Status.PUBLISHED,
            published_at=self.today,
            is_active=True,
            is_featured=True,
            content_json=valid_content_json("ثبت نام اطلاعیه عمومی"),
        )

        self.unit_announcement = Announcement.objects.create(
            title="اطلاعیه واحد دبستان",
            slug="unit-announcement",
            summary="خلاصه اطلاعیه واحد",
            category=self.announcement_category,
            scope=Announcement.Scope.UNIT,
            unit=self.unit,
            status=Announcement.Status.PUBLISHED,
            published_at=self.today - timedelta(days=2),
            is_active=True,
            is_featured=False,
            content_json=valid_content_json("جلسه والدین دبستان"),
        )

        News.objects.create(
            title="خبر پیش‌نویس",
            slug="draft-news",
            summary="خلاصه",
            category=self.news_category,
            scope=News.Scope.SCHOOL,
            status=News.Status.DRAFT,
            is_active=True,
            content_json=valid_content_json("خبر پیش‌نویس"),
        )

        Announcement.objects.create(
            title="اطلاعیه آینده",
            slug="future-announcement",
            summary="خلاصه",
            category=self.announcement_category,
            scope=Announcement.Scope.SCHOOL,
            status=Announcement.Status.PUBLISHED,
            published_at=self.today + timedelta(days=1),
            is_active=True,
            content_json=valid_content_json("اطلاعیه آینده"),
        )

        self.unit_gallery_item = GalleryItem.objects.create(
            title="تصویر واحد دبستان",
            slug="unit-gallery-item",
            summary="گزارش تصویری واحد",
            media_url="https://cdn.example.com/gallery/unit.jpg",
            scope=GalleryItem.Scope.UNIT,
            unit=self.unit,
            status=GalleryItem.Status.PUBLISHED,
            published_at=self.today,
            is_active=True,
        )

    def test_content_aggregate_returns_all_supported_types(self):
        response = self.client.get("/api/content/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 5)

        returned_types = {item["type"] for item in response.data["results"]}

        self.assertEqual(returned_types, {"news", "announcement", "gallery"})

    def test_content_type_gallery_matches_frontend_unit_service(self):
        response = self.client.get(
            f"/api/content/?type=gallery&scope=unit&unit_id={self.unit.id}"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["type"], "gallery")
        self.assertEqual(response.data["results"][0]["unit_id"], self.unit.id)

    def test_content_type_news_returns_only_news(self):
        response = self.client.get("/api/content/?type=news")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)

        for item in response.data["results"]:
            self.assertEqual(item["type"], "news")

    def test_content_type_announcement_returns_only_announcements(self):
        response = self.client.get("/api/content/?type=announcement")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)

        for item in response.data["results"]:
            self.assertEqual(item["type"], "announcement")

    def test_content_status_other_than_published_returns_empty_result(self):
        response = self.client.get("/api/content/?status=draft")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_content_filter_school_scope(self):
        response = self.client.get("/api/content/?scope=school")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)

        for item in response.data["results"]:
            self.assertEqual(item["scope"], "school")
            self.assertIsNone(item["unit"])

    def test_content_filter_unit_scope(self):
        response = self.client.get(f"/api/content/?scope=unit&unit_id={self.unit.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 3)

        for item in response.data["results"]:
            self.assertEqual(item["scope"], "unit")
            self.assertEqual(item["unit"]["id"], self.unit.id)

    def test_content_unit_scope_without_unit_id_returns_empty_result(self):
        response = self.client.get("/api/content/?scope=unit")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_content_search_across_news_and_announcements(self):
        response = self.client.get("/api/content/?search=ثبت نام")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)

        returned_types = {item["type"] for item in response.data["results"]}

        self.assertEqual(returned_types, {"news", "announcement"})

    def test_content_featured_filter(self):
        response = self.client.get("/api/content/?featured=true")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)

        for item in response.data["results"]:
            self.assertTrue(item["is_featured"])

    def test_content_category_filter_news_slug(self):
        response = self.client.get("/api/content/?category=news")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)

        for item in response.data["results"]:
            self.assertEqual(item["type"], "news")

    def test_content_category_filter_announcement_slug(self):
        response = self.client.get("/api/content/?category=announcements")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)

        for item in response.data["results"]:
            self.assertEqual(item["type"], "announcement")

    def test_content_invalid_type_returns_400(self):
        response = self.client.get("/api/content/?type=video")

        self.assertEqual(response.status_code, 400)

    def test_content_ordering_by_title(self):
        response = self.client.get("/api/content/?ordering=title")

        self.assertEqual(response.status_code, 200)

        titles = [item["title"] for item in response.data["results"]]

        self.assertEqual(titles, sorted(titles))


class CMSContentRevisionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="editor",
            password="password123",
        )
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.role = UserProfile.Role.GENERAL_MANAGER
        profile.is_active = True
        profile.save()
        self.client.force_authenticate(user=self.user)

    @staticmethod
    def native_document(text):
        return {
            "type": "doc",
            "content": [
                {
                    "type": "heading",
                    "attrs": {"level": 2},
                    "content": [{"type": "text", "text": text}],
                },
                {
                    "type": "table",
                    "content": [
                        {
                            "type": "tableRow",
                            "content": [
                                {
                                    "type": "tableCell",
                                    "content": [
                                        {
                                            "type": "paragraph",
                                            "content": [{"type": "text", "text": "سلول جدول"}],
                                        }
                                    ],
                                }
                            ],
                        }
                    ],
                },
                {
                    "type": "besatGalleryBlock",
                    "attrs": {"items": [{"src": "https://example.com/image.jpg"}]},
                },
            ],
        }

    def create_content(self, title="سند بدون افت اطلاعات"):
        return self.client.post(
            "/api/cms/content/",
            {
                "kind": "news",
                "title": title,
                "summary": "خلاصه محتوا",
                "body_html": f"<h2>{title}</h2>",
                "body_json": self.native_document(title),
                "scope": "school",
            },
            format="json",
        )

    def test_cms_preserves_native_editor_document_and_creates_revision(self):
        response = self.create_content()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["body_json"], self.native_document("سند بدون افت اطلاعات"))
        self.assertIn("data-besat-gallery-item", response.data["body_html"])
        self.assertEqual(ContentRevision.objects.count(), 1)
        revision = ContentRevision.objects.get()
        self.assertEqual(revision.snapshot["body_json"], response.data["body_json"])

    def test_direct_native_delete_removes_content_revisions(self):
        created = self.create_content()
        self.assertEqual(created.status_code, 201)
        content_id = int(created.data["id"].removeprefix("news-"))

        News.objects.get(pk=content_id).delete()

        self.assertFalse(
            ContentRevision.objects.filter(
                content_kind=ContentRevision.Kind.NEWS,
                object_id=content_id,
            ).exists()
        )

    def test_autosave_coalesces_recent_revision_and_restore_returns_snapshot(self):
        created = self.create_content("نسخه اول")
        self.assertEqual(created.status_code, 201)
        content_id = created.data["id"]

        autosave = self.client.patch(
            f"/api/cms/content/{content_id}/",
            {
                "title": "نسخه دوم",
                "body_html": "<p>نسخه دوم</p>",
                "body_json": self.native_document("نسخه دوم"),
                "autosave": True,
                "version": created.data["version"],
            },
            format="json",
        )
        self.assertEqual(autosave.status_code, 200)
        self.assertEqual(ContentRevision.objects.count(), 1)

        revisions = self.client.get(f"/api/cms/content/{content_id}/revisions/")
        self.assertEqual(revisions.status_code, 200)
        self.assertEqual(revisions.data[0]["snapshot"]["title"], "نسخه دوم")

        restored = self.client.post(
            f"/api/cms/content/{content_id}/revisions/{revisions.data[0]['id']}/restore/",
            {"version": autosave.data["version"]},
            format="json",
        )
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(restored.data["title"], "نسخه دوم")


class CMSContentConcurrentSaveConflictTests(TestCase):
    """FE-CMS-EDITOR-CONCURRENT-SAVE-LOSS-001: two tabs/sessions holding
    the same content open, each editing a different field from their own
    (now-stale, for whichever saves second) snapshot, used to silently
    clobber each other -- the second save's stale copy of every OTHER
    field overwrote the first save's already-persisted change, with no
    conflict ever surfaced. The frontend has sent `version` back on every
    save/workflow call for a long time already (panel-service.ts); the
    backend just never validated it."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="editor2", password="password123")
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.role = UserProfile.Role.GENERAL_MANAGER
        profile.is_active = True
        profile.save()
        self.client.force_authenticate(user=self.user)

    def create_content(self, title="محتوای آزمایشی"):
        return self.client.post(
            "/api/cms/content/",
            {
                "kind": "news",
                "title": title,
                "summary": "خلاصه اول",
                "body_html": f"<p>{title}</p>",
                "scope": "school",
            },
            format="json",
        )

    def test_create_response_exposes_version_starting_at_one(self):
        response = self.create_content()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["version"], 1)

    def test_update_with_the_current_version_succeeds_and_bumps_it(self):
        content_id = self.create_content().data["id"]

        response = self.client.patch(
            f"/api/cms/content/{content_id}/", {"title": "عنوان جدید", "version": 1}, format="json"
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["title"], "عنوان جدید")
        self.assertEqual(response.data["version"], 2)

    def test_update_without_any_version_precondition_is_rejected(self):
        # SEC-CMS-EDITOR-OCC-BYPASS-001: an earlier version of this guard
        # treated a missing version as "no check requested" and let the
        # write through -- a live bypass of the whole guarantee, since any
        # caller could just omit the field. A precondition is now
        # mandatory: missing is rejected exactly like stale.
        content_id = self.create_content().data["id"]

        response = self.client.patch(f"/api/cms/content/{content_id}/", {"title": "بدون نسخه"}, format="json")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "content_conflict")

    def test_update_with_a_malformed_version_is_rejected(self):
        content_id = self.create_content().data["id"]

        response = self.client.patch(
            f"/api/cms/content/{content_id}/", {"title": "نسخه نامعتبر", "version": "not-a-number"}, format="json"
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "content_conflict")

    def test_update_with_a_stale_if_match_header_only_is_rejected(self):
        # Codex's adjacent probe: sending the stale version ONLY via
        # If-Match (the body omits `version` entirely) used to sail
        # through untouched, since the old check only ever looked at the
        # body field.
        content_id = self.create_content().data["id"]
        self.client.patch(f"/api/cms/content/{content_id}/", {"title": "اولین ویرایش", "version": 1}, format="json")

        response = self.client.patch(
            f"/api/cms/content/{content_id}/",
            {"summary": "خلاصه جدید"},
            format="json",
            HTTP_IF_MATCH=f'W/"content-{content_id}-v1"',
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "content_conflict")

    def test_update_with_the_current_version_via_if_match_header_only_succeeds(self):
        content_id = self.create_content().data["id"]

        response = self.client.patch(
            f"/api/cms/content/{content_id}/",
            {"title": "عنوان از طریق هدر"},
            format="json",
            HTTP_IF_MATCH=f'W/"content-{content_id}-v1"',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["version"], 2)

    def test_update_with_a_stale_version_is_rejected_as_a_conflict_not_silently_applied(self):
        content_id = self.create_content().data["id"]
        self.client.patch(f"/api/cms/content/{content_id}/", {"title": "اولین ویرایش", "version": 1}, format="json")

        stale = self.client.patch(
            f"/api/cms/content/{content_id}/", {"summary": "خلاصه دوم", "version": 1}, format="json"
        )

        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.data["code"], "content_conflict")
        self.assertEqual(stale.data["current"]["id"], content_id)
        self.assertEqual(stale.data["current"]["version"], 2)

    def test_two_tabs_editing_different_fields_from_a_stale_snapshot_does_not_lose_the_first_save(self):
        # The exact Codex repro: Tab A changes title and saves; Tab B
        # changes only summary from its own (now-stale) snapshot and
        # saves. The final row must keep Tab A's title, not silently
        # revert it -- Tab B's save must be rejected instead.
        content_id = self.create_content(title="عنوان اصلی").data["id"]

        tab_a = self.client.patch(
            f"/api/cms/content/{content_id}/", {"title": "عنوان تب A", "version": 1}, format="json"
        )
        self.assertEqual(tab_a.status_code, 200)

        tab_b = self.client.patch(
            f"/api/cms/content/{content_id}/", {"summary": "خلاصه تب B", "version": 1}, format="json"
        )
        self.assertEqual(tab_b.status_code, 409)

        final = self.client.get(f"/api/cms/content/{content_id}/")
        self.assertEqual(final.data["title"], "عنوان تب A")
        self.assertNotEqual(final.data["summary"], "خلاصه تب B")

    def test_workflow_action_with_a_stale_version_is_rejected(self):
        content_id = self.create_content().data["id"]
        self.client.patch(f"/api/cms/content/{content_id}/", {"title": "ویرایش قبل از ارسال", "version": 1}, format="json")

        response = self.client.post(
            f"/api/cms/content/{content_id}/submit-review/", {"version": 1}, format="json"
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "content_conflict")
        final = self.client.get(f"/api/cms/content/{content_id}/")
        self.assertEqual(final.data["status"], "draft")

    def test_workflow_action_with_the_current_version_succeeds_and_bumps_it(self):
        content_id = self.create_content().data["id"]

        response = self.client.post(
            f"/api/cms/content/{content_id}/submit-review/", {"version": 1}, format="json"
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["status"], "in_review")
        self.assertEqual(response.data["version"], 2)

    def test_delete_without_any_version_precondition_is_rejected(self):
        # SEC-CMS-EDITOR-OCC-BYPASS-001: a stale/missing-precondition
        # DELETE is at least as dangerous as a stale PATCH -- it can
        # discard a concurrent editor's just-saved change irrecoverably.
        content_id = self.create_content().data["id"]

        response = self.client.delete(f"/api/cms/content/{content_id}/")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "content_conflict")
        self.assertTrue(News.objects.filter(pk=int(content_id.removeprefix("news-"))).exists())

    def test_delete_with_a_stale_version_is_rejected(self):
        content_id = self.create_content().data["id"]
        self.client.patch(f"/api/cms/content/{content_id}/", {"title": "ویرایش قبل از حذف", "version": 1}, format="json")

        response = self.client.delete(
            f"/api/cms/content/{content_id}/", {"version": 1}, format="json"
        )

        self.assertEqual(response.status_code, 409)
        self.assertTrue(News.objects.filter(pk=int(content_id.removeprefix("news-"))).exists())

    def test_delete_with_the_current_version_succeeds(self):
        content_id = self.create_content().data["id"]

        response = self.client.delete(
            f"/api/cms/content/{content_id}/", {"version": 1}, format="json"
        )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(News.objects.filter(pk=int(content_id.removeprefix("news-"))).exists())


class CMSContentSEOFieldsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="seo-editor",
            password="password123",
        )
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.role = UserProfile.Role.GENERAL_MANAGER
        profile.is_active = True
        profile.save()
        self.client.force_authenticate(user=self.user)

    def create_content_with_seo(self, seo):
        return self.client.post(
            "/api/cms/content/",
            {
                "kind": "news",
                "title": "خبر با سئوی کامل",
                "summary": "خلاصه محتوا",
                "body_html": "<p>متن</p>",
                "body_json": {
                    "type": "doc",
                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "متن"}]}],
                },
                "scope": "school",
                "seo": seo,
            },
            format="json",
        )

    def test_create_persists_full_seo_payload(self):
        response = self.create_content_with_seo(
            {
                "focus_keyphrase": "بعثت",
                "seo_title": "عنوان سئو خبر",
                "meta_description": "توضیحات متای خبر",
                "canonical_url": "https://besat.example.com/news/sample",
                "og_title": "عنوان اشتراک‌گذاری",
                "og_description": "توضیح اشتراک‌گذاری",
                "og_image_url": "https://besat.example.com/media/cover.jpg",
                "is_indexable": False,
                "is_followable": False,
                "is_cornerstone": True,
            }
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["seo"]["focus_keyphrase"], "بعثت")
        self.assertEqual(response.data["seo"]["seo_title"], "عنوان سئو خبر")
        self.assertFalse(response.data["seo"]["is_indexable"])
        self.assertFalse(response.data["seo"]["is_followable"])
        self.assertTrue(response.data["seo"]["is_cornerstone"])

        content_id = response.data["id"]
        news_id = int(content_id.removeprefix("news-"))
        news = News.objects.get(pk=news_id)
        self.assertEqual(news.canonical_url, "https://besat.example.com/news/sample")
        self.assertEqual(news.og_image_url, "https://besat.example.com/media/cover.jpg")

    def test_create_without_seo_payload_uses_safe_defaults(self):
        response = self.client.post(
            "/api/cms/content/",
            {
                "kind": "news",
                "title": "خبر بدون سئو",
                "summary": "خلاصه",
                "body_html": "<p>متن</p>",
                "body_json": {
                    "type": "doc",
                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "متن"}]}],
                },
                "scope": "school",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data["seo"]["focus_keyphrase"])
        self.assertTrue(response.data["seo"]["is_indexable"])
        self.assertTrue(response.data["seo"]["is_followable"])
        self.assertFalse(response.data["seo"]["is_cornerstone"])

    def test_partial_update_only_changes_supplied_seo_fields(self):
        created = self.create_content_with_seo(
            {
                "focus_keyphrase": "بعثت",
                "meta_description": "توضیحات اولیه",
                "is_cornerstone": True,
            }
        )
        self.assertEqual(created.status_code, 201, created.data)
        content_id = created.data["id"]

        updated = self.client.patch(
            f"/api/cms/content/{content_id}/",
            {"seo": {"meta_description": "توضیحات بروزشده"}, "version": created.data["version"]},
            format="json",
        )

        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data["seo"]["meta_description"], "توضیحات بروزشده")
        self.assertEqual(updated.data["seo"]["focus_keyphrase"], "بعثت")
        self.assertTrue(updated.data["seo"]["is_cornerstone"])

    def test_revision_restore_recovers_previous_seo_metadata(self):
        created = self.create_content_with_seo({"seo_title": "نسخه اول سئو"})
        self.assertEqual(created.status_code, 201, created.data)
        content_id = created.data["id"]

        updated = self.client.patch(
            f"/api/cms/content/{content_id}/",
            {
                "seo": {"seo_title": "نسخه دوم سئو"},
                "autosave": False,
                "version": created.data["version"],
            },
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)

        revisions = self.client.get(f"/api/cms/content/{content_id}/revisions/")
        self.assertEqual(revisions.status_code, 200)
        first_revision_id = revisions.data[-1]["id"]

        restored = self.client.post(
            f"/api/cms/content/{content_id}/revisions/{first_revision_id}/restore/",
            {"version": updated.data["version"]},
            format="json",
        )

        self.assertEqual(restored.status_code, 200, restored.data)
        self.assertEqual(restored.data["seo"]["seo_title"], "نسخه اول سئو")


class CMSContentImportantNewsFieldTests(TestCase):
    """is_important/priority drive the homepage's "important news" rail
    (HomeNewsSection queries important=true&featured=false) -- both fields
    already existed on the News model with a dedicated DB index, but were
    never wired into the CMS write/read path, so there was no way to ever
    populate that homepage section. Announcement has no such fields."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="important-editor", password="password123")
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.role = UserProfile.Role.GENERAL_MANAGER
        profile.is_active = True
        profile.save()
        self.client.force_authenticate(user=self.user)

    def test_create_news_with_is_important_and_priority(self):
        response = self.client.post(
            "/api/cms/content/",
            {
                "kind": "news",
                "title": "خبر مهم",
                "summary": "خلاصه",
                "body_html": "<p>متن</p>",
                "scope": "school",
                "is_important": True,
                "priority": 5,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["is_important"])
        self.assertEqual(response.data["priority"], 5)

        news_id = int(response.data["id"].removeprefix("news-"))
        news = News.objects.get(pk=news_id)
        self.assertTrue(news.is_important)
        self.assertEqual(news.priority, 5)

    def test_update_can_toggle_is_important(self):
        create = self.client.post(
            "/api/cms/content/",
            {
                "kind": "news",
                "title": "خبر معمولی",
                "summary": "خلاصه",
                "body_html": "<p>متن</p>",
                "scope": "school",
            },
            format="json",
        )
        content_id = create.data["id"]

        update = self.client.patch(
            f"/api/cms/content/{content_id}/",
            {"is_important": True, "priority": 2, "version": create.data["version"]},
            format="json",
        )

        self.assertEqual(update.status_code, 200, update.data)
        self.assertTrue(update.data["is_important"])
        self.assertEqual(update.data["priority"], 2)

    def test_announcement_ignores_is_important_since_the_field_does_not_exist(self):
        response = self.client.post(
            "/api/cms/content/",
            {
                "kind": "announcement",
                "title": "اطلاعیه‌ای بدون مفهوم اهمیت",
                "summary": "خلاصه",
                "body_html": "<p>متن</p>",
                "scope": "school",
                "is_important": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertFalse(response.data["is_important"])


class CMSContentUnitMediaDeleteRestrictionTests(TestCase):
    """The media role authors its own unit's content via /api/cms/content/
    but may not delete it — see CMSContentViewSet._ensure_delete_access."""

    def setUp(self):
        self.client = APIClient()
        self.unit = SchoolUnit.objects.create(title="دبستان", slug="primary-school", is_active=True)

        self.unit_media = User.objects.create_user(username="unitmedia", password="password123")
        media_profile, _ = UserProfile.objects.get_or_create(user=self.unit_media)
        media_profile.role = UserProfile.Role.UNIT_MEDIA
        media_profile.is_active = True
        media_profile.save()
        UserUnitMembership.objects.create(
            user=self.unit_media,
            unit=self.unit,
            role=UserUnitMembership.UnitRole.UNIT_MEDIA,
            is_active=True,
        )

        self.unit_manager = User.objects.create_user(username="unitmanager", password="password123")
        manager_profile, _ = UserProfile.objects.get_or_create(user=self.unit_manager)
        manager_profile.role = UserProfile.Role.UNIT_MANAGER
        manager_profile.is_active = True
        manager_profile.save()
        UserUnitMembership.objects.create(
            user=self.unit_manager,
            unit=self.unit,
            role=UserUnitMembership.UnitRole.UNIT_MANAGER,
            is_active=True,
        )

    def create_unit_content(self, author):
        self.client.force_authenticate(user=author)
        response = self.client.post(
            "/api/cms/content/",
            {
                "kind": "news",
                "title": "خبر واحد",
                "summary": "خلاصه",
                "body_html": "<p>متن</p>",
                "body_json": {
                    "type": "doc",
                    "content": [
                        {"type": "paragraph", "content": [{"type": "text", "text": "متن"}]}
                    ],
                },
                "scope": "unit",
                "unit_id": self.unit.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data["id"]

    def test_unit_media_can_create_but_not_delete_own_unit_content(self):
        content_id = self.create_unit_content(self.unit_media)

        response = self.client.delete(f"/api/cms/content/{content_id}/")

        self.assertEqual(response.status_code, 403)

    def test_unit_manager_can_delete_own_unit_content(self):
        content_id = self.create_unit_content(self.unit_manager)

        response = self.client.delete(f"/api/cms/content/{content_id}/", {"version": 1}, format="json")

        self.assertEqual(response.status_code, 204)


class CMSContentListPaginationAndFilterTests(TestCase):
    """The frontend CMS content list (editorial-workspace.tsx) has always
    read response.data.results/.count and sent search/status/scope/unit_id/
    featured/author/ordering query params -- but CMSContentViewSet.list()
    returned an unpaginated bare array and ignored every one of those
    params, so response.data.results was always undefined and the list
    silently rendered as empty regardless of what existed. This locks in
    the fix: real pagination shape, and every filter actually filtering."""

    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user(username="gm-list", password="password123")
        profile, _ = UserProfile.objects.get_or_create(user=self.gm)
        profile.role = UserProfile.Role.GENERAL_MANAGER
        profile.is_active = True
        profile.save()
        self.client.force_authenticate(user=self.gm)

        self.category = NewsCategory.objects.create(title="اخبار", slug="news-cat", is_active=True)
        self.draft = News.objects.create(
            title="خبر پیش‌نویس رباتیک",
            slug="draft-robotics",
            summary="خلاصه",
            category=self.category,
            scope=News.Scope.SCHOOL,
            status=News.Status.DRAFT,
            content_json=valid_content_json(),
            created_by=self.gm,
            updated_by=self.gm,
        )
        self.published = News.objects.create(
            title="خبر منتشرشده هنری",
            slug="published-art",
            summary="خلاصه",
            category=self.category,
            scope=News.Scope.SCHOOL,
            status=News.Status.PUBLISHED,
            published_at="2026-01-01",
            content_json=valid_content_json(),
            created_by=self.gm,
            updated_by=self.gm,
        )

    def test_response_is_paginated_with_results_and_count(self):
        response = self.client.get("/api/cms/content/?page=1&page_size=20")

        self.assertEqual(response.status_code, 200)
        self.assertIn("results", response.data)
        self.assertIn("count", response.data)
        self.assertEqual(response.data["count"], 2)
        ids = {item["id"] for item in response.data["results"]}
        self.assertIn(f"news-{self.draft.id}", ids)
        self.assertIn(f"news-{self.published.id}", ids)

    def test_status_filter_actually_filters(self):
        response = self.client.get("/api/cms/content/?status=draft")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], f"news-{self.draft.id}")

    def test_search_filter_actually_filters(self):
        response = self.client.get("/api/cms/content/?search=رباتیک")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], f"news-{self.draft.id}")

    def test_kind_filter_actually_filters(self):
        response = self.client.get("/api/cms/content/?kind=announcement")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_frontend_in_review_status_alias_maps_to_waiting_review(self):
        self.draft.status = News.Status.WAITING_REVIEW
        self.draft.save()

        response = self.client.get("/api/cms/content/?status=in_review")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], f"news-{self.draft.id}")

    def test_response_includes_status_summary_counts(self):
        response = self.client.get("/api/cms/content/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["summary"],
            {
                "draft": 1,
                "in_review": 0,
                "changes_requested": 0,
                "approved": 0,
                "scheduled": 0,
                "published": 1,
                "archived": 0,
            },
        )

    def test_unpublished_and_trash_are_not_valid_status_filters(self):
        """Neither exists as a stored ContentWorkflowModel.Status value, so
        filtering by them must not 500 -- they should just correctly filter
        to nothing, matching the fact that no content can ever be in either
        state (see also test_archive_and_restore_are_the_only_lifecycle_
        actions_beyond_the_core_workflow for the corresponding action-level
        proof)."""
        response = self.client.get("/api/cms/content/?status=unpublished")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

        response = self.client.get("/api/cms/content/?status=trash")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)


class CMSContentArchiveRestoreActionTests(TestCase):
    """archive/restore used to be dead buttons in the frontend -- they POSTed
    to /archive/, /trash/, /restore/ routes that didn't exist on
    CMSContentViewSet at all (404 on every click), even though "archived" is
    a real apps.core.models.ContentWorkflowModel.Status value. This proves
    the two real actions now exist and enforce the same publish<->archived
    transition apps.content.cms._validated_values already allowed via a
    plain PATCH. There is deliberately no "trash" action to test: "trash"
    is not a stored status and was removed from the UI rather than given a
    fake backing action."""

    def setUp(self):
        self.client = APIClient()
        self.gm = User.objects.create_user(username="gm-archive", password="password123")
        profile, _ = UserProfile.objects.get_or_create(user=self.gm)
        profile.role = UserProfile.Role.GENERAL_MANAGER
        profile.is_active = True
        profile.save()
        self.client.force_authenticate(user=self.gm)

        self.published = News.objects.create(
            title="خبر منتشرشده برای آرشیو",
            slug="published-for-archive",
            summary="خلاصه",
            scope=News.Scope.SCHOOL,
            status=News.Status.PUBLISHED,
            published_at="2026-01-01",
            content_json=valid_content_json(),
            created_by=self.gm,
            updated_by=self.gm,
        )
        self.draft = News.objects.create(
            title="خبر پیش‌نویس",
            slug="draft-for-archive",
            summary="خلاصه",
            scope=News.Scope.SCHOOL,
            status=News.Status.DRAFT,
            content_json=valid_content_json(),
            created_by=self.gm,
            updated_by=self.gm,
        )

    def test_archive_moves_published_content_to_archived(self):
        response = self.client.post(
            f"/api/cms/content/news-{self.published.id}/archive/", {"version": 1}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "archived")
        self.published.refresh_from_db()
        self.assertEqual(self.published.status, News.Status.ARCHIVED)

    def test_archive_rejects_non_published_content(self):
        response = self.client.post(f"/api/cms/content/news-{self.draft.id}/archive/")

        self.assertEqual(response.status_code, 400)

    def test_restore_moves_archived_content_back_to_draft(self):
        self.published.status = News.Status.ARCHIVED
        self.published.save()

        response = self.client.post(
            f"/api/cms/content/news-{self.published.id}/restore/", {"version": 1}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "draft")
        self.published.refresh_from_db()
        self.assertEqual(self.published.status, News.Status.DRAFT)

    def test_restore_rejects_non_archived_content(self):
        response = self.client.post(f"/api/cms/content/news-{self.draft.id}/restore/")

        self.assertEqual(response.status_code, 400)

    def test_reject_stores_the_reviewers_actual_comment_as_the_revision_note(self):
        self.published.status = News.Status.WAITING_REVIEW
        self.published.save()

        response = self.client.post(
            f"/api/cms/content/news-{self.published.id}/reject/",
            {"comment": "عنوان باید کوتاه‌تر شود.", "version": 1},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        # The item-level status the author sees uses the frontend's own
        # vocabulary ("changes_requested"), not the raw stored "rejected" --
        # see test_rejected_item_status_is_exposed_as_changes_requested for
        # the full proof of why this matters (it drives which action buttons
        # the editor shows).
        self.assertEqual(response.data["status"], "changes_requested")

        revision = ContentRevision.objects.filter(
            content_kind="news",
            object_id=self.published.id,
        ).order_by("-created_at").first()
        self.assertEqual(revision.note, "عنوان باید کوتاه‌تر شود.")

    def test_reject_without_a_comment_falls_back_to_the_generic_note(self):
        self.published.status = News.Status.WAITING_REVIEW
        self.published.save()

        self.client.post(f"/api/cms/content/news-{self.published.id}/reject/", {"version": 1}, format="json")

        revision = ContentRevision.objects.filter(
            content_kind="news",
            object_id=self.published.id,
        ).order_by("-created_at").first()
        self.assertEqual(revision.note, "رد محتوا")

    def test_waiting_review_item_status_is_exposed_as_in_review(self):
        """Same bug, same fix, the other real status the frontend renames:
        editorial-workspace.tsx only shows the approve/reject buttons when
        currentItem.status === "in_review" -- returning the raw
        "waiting_review" value hid those buttons from every reviewer for
        content that was, in fact, waiting on their review."""
        self.published.status = News.Status.WAITING_REVIEW
        self.published.save()

        response = self.client.get(f"/api/cms/content/news-{self.published.id}/")

        self.assertEqual(response.data["status"], "in_review")

    def test_rejected_item_status_is_exposed_as_changes_requested(self):
        """The frontend's editorial-workspace.tsx compares currentItem.status
        against "changes_requested" everywhere (the resubmit-for-review
        button, the reject-requires-a-comment guard, the workflow pipeline
        highlight) -- if the API returned the raw "rejected" value instead,
        every one of those comparisons would silently be false and an
        author whose content was rejected would have no visible way to
        resubmit it."""
        self.published.status = News.Status.REJECTED
        self.published.save()

        response = self.client.get(f"/api/cms/content/news-{self.published.id}/")

        self.assertEqual(response.data["status"], "changes_requested")

    def test_trash_and_unpublish_routes_do_not_exist(self):
        self.assertEqual(
            self.client.post(f"/api/cms/content/news-{self.published.id}/trash/").status_code,
            404,
        )
        self.assertEqual(
            self.client.post(f"/api/cms/content/news-{self.published.id}/unpublish/").status_code,
            404,
        )


class CMSContentPermissionScopeTests(TestCase):
    """Role-scoped visibility, cross-unit write rejection, and workflow
    transition gates for /api/cms/content/ -- this is the live authoring
    endpoint (CMSContentViewSet); the equivalent legacy coverage for the
    unreachable per-app CMSNewsViewSet/CMSAnnouncementViewSet was removed
    along with that dead code."""

    def setUp(self):
        self.client = APIClient()
        self.unit_1 = SchoolUnit.objects.create(title="دبستان", slug="primary-school", is_active=True, order=1)
        self.unit_2 = SchoolUnit.objects.create(title="متوسطه", slug="middle-school", is_active=True, order=2)

        self.general_manager = self._make_user("general", UserProfile.Role.GENERAL_MANAGER)
        self.unit_manager = self._make_user("unitmanager", UserProfile.Role.UNIT_MANAGER)
        self.unit_media = self._make_user("unitmedia", UserProfile.Role.UNIT_MEDIA)

        UserUnitMembership.objects.create(
            user=self.unit_manager,
            unit=self.unit_1,
            role=UserUnitMembership.UnitRole.UNIT_MANAGER,
            is_active=True,
        )
        UserUnitMembership.objects.create(
            user=self.unit_media,
            unit=self.unit_1,
            role=UserUnitMembership.UnitRole.UNIT_MEDIA,
            is_active=True,
        )

        self.category = NewsCategory.objects.create(title="اخبار", slug="news", is_active=True)
        self.unit_1_news = News.objects.create(
            title="خبر واحد دبستان",
            slug="unit-1-news",
            summary="خلاصه",
            category=self.category,
            scope=News.Scope.UNIT,
            unit=self.unit_1,
            status=News.Status.DRAFT,
            content_json=valid_content_json(),
            created_by=self.unit_manager,
            updated_by=self.unit_manager,
        )
        self.unit_2_news = News.objects.create(
            title="خبر واحد متوسطه",
            slug="unit-2-news",
            summary="خلاصه",
            category=self.category,
            scope=News.Scope.UNIT,
            unit=self.unit_2,
            status=News.Status.DRAFT,
            content_json=valid_content_json(),
            created_by=self.general_manager,
            updated_by=self.general_manager,
        )

    def _make_user(self, username, role):
        user = User.objects.create_user(username=username, password="password123")
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.is_active = True
        profile.save()
        return user

    def _create_payload(self, unit, scope="unit"):
        return {
            "kind": "news",
            "title": "خبر جدید",
            "summary": "خلاصه",
            "body_html": "<p>متن</p>",
            "body_json": {
                "type": "doc",
                "content": [{"type": "paragraph", "content": [{"type": "text", "text": "متن"}]}],
            },
            "scope": scope,
            "unit_id": unit.id if unit else None,
        }

    def test_general_manager_sees_all_draft_content(self):
        self.client.force_authenticate(user=self.general_manager)

        response = self.client.get("/api/cms/content/")

        ids = {item["id"] for item in response.data["results"]}
        self.assertIn(f"news-{self.unit_1_news.id}", ids)
        self.assertIn(f"news-{self.unit_2_news.id}", ids)

    def test_unit_manager_sees_only_own_unit_draft_content(self):
        self.client.force_authenticate(user=self.unit_manager)

        response = self.client.get("/api/cms/content/")

        ids = {item["id"] for item in response.data["results"]}
        self.assertIn(f"news-{self.unit_1_news.id}", ids)
        self.assertNotIn(f"news-{self.unit_2_news.id}", ids)

    def test_unit_media_sees_only_own_unit_draft_content(self):
        self.client.force_authenticate(user=self.unit_media)

        response = self.client.get("/api/cms/content/")

        ids = {item["id"] for item in response.data["results"]}
        self.assertIn(f"news-{self.unit_1_news.id}", ids)
        self.assertNotIn(f"news-{self.unit_2_news.id}", ids)

    def test_anonymous_user_does_not_see_unpublished_content(self):
        response = self.client.get("/api/cms/content/")

        ids = {item["id"] for item in response.data["results"]}
        self.assertNotIn(f"news-{self.unit_1_news.id}", ids)
        self.assertNotIn(f"news-{self.unit_2_news.id}", ids)

    def test_unit_manager_cannot_create_content_for_other_unit(self):
        self.client.force_authenticate(user=self.unit_manager)

        response = self.client.post("/api/cms/content/", self._create_payload(self.unit_2), format="json")

        self.assertEqual(response.status_code, 403)

    def test_unit_media_cannot_create_content_for_other_unit(self):
        self.client.force_authenticate(user=self.unit_media)

        response = self.client.post("/api/cms/content/", self._create_payload(self.unit_2), format="json")

        self.assertEqual(response.status_code, 403)

    def test_unit_manager_cannot_create_school_scope_content(self):
        self.client.force_authenticate(user=self.unit_manager)

        response = self.client.post(
            "/api/cms/content/",
            self._create_payload(None, scope="school"),
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_general_manager_can_create_school_scope_content(self):
        self.client.force_authenticate(user=self.general_manager)

        response = self.client.post(
            "/api/cms/content/",
            self._create_payload(None, scope="school"),
            format="json",
        )

        self.assertEqual(response.status_code, 201)

    def test_unit_manager_can_submit_and_approve_own_unit_content(self):
        self.client.force_authenticate(user=self.unit_manager)
        content_id = f"news-{self.unit_1_news.id}"

        submit_response = self.client.post(
            f"/api/cms/content/{content_id}/submit-review/", {"version": self.unit_1_news.version}, format="json"
        )
        self.assertEqual(submit_response.status_code, 200)
        self.assertEqual(submit_response.data["status"], "in_review")

        approve_response = self.client.post(
            f"/api/cms/content/{content_id}/approve/", {"version": submit_response.data["version"]}, format="json"
        )
        self.assertEqual(approve_response.status_code, 200)
        self.assertEqual(approve_response.data["status"], "approved")

    def test_unit_manager_cannot_publish_content(self):
        self.unit_1_news.status = News.Status.APPROVED
        self.unit_1_news.save()
        self.client.force_authenticate(user=self.unit_manager)

        response = self.client.post(f"/api/cms/content/news-{self.unit_1_news.id}/publish/")

        self.assertEqual(response.status_code, 403)

    def test_general_manager_can_publish_approved_content(self):
        self.unit_1_news.status = News.Status.APPROVED
        self.unit_1_news.save()
        self.client.force_authenticate(user=self.general_manager)

        response = self.client.post(
            f"/api/cms/content/news-{self.unit_1_news.id}/publish/",
            {"version": self.unit_1_news.version},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "published")

    def test_unit_manager_cannot_edit_published_content_even_with_status_omitted(self):
        # AUTH-CMS-PUBLISHED-MUTATION-001: the frontend's own save payload
        # always omits "status", which used to skip the terminal-state
        # check entirely and let any other field (and, for an archived
        # item, is_active) be silently persisted.
        self.unit_1_news.status = News.Status.PUBLISHED
        self.unit_1_news.published_at = timezone.now()
        self.unit_1_news.save()
        self.client.force_authenticate(user=self.unit_manager)

        response = self.client.patch(
            f"/api/cms/content/news-{self.unit_1_news.id}/",
            {"title": "عنوان دستکاری‌شده"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.unit_1_news.refresh_from_db()
        self.assertEqual(self.unit_1_news.title, "خبر واحد دبستان")

    def test_unit_manager_cannot_reactivate_archived_content_via_plain_edit(self):
        self.unit_1_news.status = News.Status.ARCHIVED
        self.unit_1_news.is_active = False
        self.unit_1_news.save()
        self.client.force_authenticate(user=self.unit_manager)

        response = self.client.patch(
            f"/api/cms/content/news-{self.unit_1_news.id}/",
            {"title": "عنوان دستکاری‌شده"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.unit_1_news.refresh_from_db()
        self.assertFalse(self.unit_1_news.is_active)

    def test_unit_manager_cannot_delete_published_content(self):
        # AUTH-EVENT-PUBLISHED-DELETE-001's counterpart for generic CMS
        # content -- the same defect class, found via a duplicate-pattern
        # check rather than a separately-filed finding.
        self.unit_1_news.status = News.Status.PUBLISHED
        self.unit_1_news.published_at = timezone.now()
        self.unit_1_news.save()
        self.client.force_authenticate(user=self.unit_manager)

        response = self.client.delete(f"/api/cms/content/news-{self.unit_1_news.id}/")

        self.assertEqual(response.status_code, 403)
        self.assertTrue(News.objects.filter(pk=self.unit_1_news.id).exists())

    def test_general_manager_can_still_edit_and_delete_published_content(self):
        # Confirms the fix is scoped to non-GM roles only.
        self.unit_1_news.status = News.Status.PUBLISHED
        self.unit_1_news.published_at = timezone.now()
        self.unit_1_news.save()
        self.client.force_authenticate(user=self.general_manager)

        patch_response = self.client.patch(
            f"/api/cms/content/news-{self.unit_1_news.id}/",
            {"title": "عنوان ویرایش‌شده توسط مدیر کل", "version": self.unit_1_news.version},
            format="json",
        )
        self.assertEqual(patch_response.status_code, 200)

        delete_response = self.client.delete(
            f"/api/cms/content/news-{self.unit_1_news.id}/",
            {"version": patch_response.data["version"]},
            format="json",
        )
        self.assertEqual(delete_response.status_code, 204)
