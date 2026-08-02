from tempfile import TemporaryDirectory

from cms.api import add_plugin, create_page
from cms.models import Page, PageContent
from cms.plugin_pool import plugin_pool
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command, CommandError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import (
    AboutFounderItem,
    AboutGalleryItem,
    AboutGoalItem,
    AboutHistoryItem,
    AboutValueItem,
)


EXPECTED_PLUGIN_TYPES = (
    "AboutHeroPlugin",
    "AboutRichTextPlugin",
    "AboutHistoryPlugin",
    "AboutFoundersPlugin",
    "AboutValuesPlugin",
    "AboutGoalsPlugin",
    "AboutGalleryPlugin",
    "AboutVideoPlugin",
)

EXPECTED_PLUGIN_FIELDS = {
    "AboutHeroPlugin": {
        "id",
        "plugin_type",
        "parent_plugin_type",
        "eyebrow",
        "title",
        "subtitle",
        "background_image",
        "image_alt",
        "cta_label",
        "cta_url",
    },
    "AboutRichTextPlugin": {
        "id",
        "plugin_type",
        "parent_plugin_type",
        "heading",
        "body_html",
    },
    "AboutHistoryPlugin": {
        "id",
        "plugin_type",
        "parent_plugin_type",
        "heading",
        "intro",
        "items",
    },
    "AboutFoundersPlugin": {
        "id",
        "plugin_type",
        "parent_plugin_type",
        "heading",
        "intro",
        "items",
    },
    "AboutValuesPlugin": {
        "id",
        "plugin_type",
        "parent_plugin_type",
        "heading",
        "intro",
        "items",
    },
    "AboutGoalsPlugin": {
        "id",
        "plugin_type",
        "parent_plugin_type",
        "heading",
        "intro",
        "items",
    },
    "AboutGalleryPlugin": {
        "id",
        "plugin_type",
        "parent_plugin_type",
        "heading",
        "intro",
        "items",
    },
    "AboutVideoPlugin": {
        "id",
        "plugin_type",
        "parent_plugin_type",
        "heading",
        "video_url",
        "poster",
        "caption",
        "autoplay",
    },
}

EXPECTED_ITEM_FIELDS = {
    "AboutHistoryPlugin": {"id", "year", "title", "description", "order"},
    "AboutFoundersPlugin": {
        "id",
        "full_name",
        "role",
        "bio",
        "image",
        "image_alt",
        "order",
    },
    "AboutValuesPlugin": {"id", "title", "description", "icon", "order"},
    "AboutGoalsPlugin": {"id", "title", "description", "order"},
    "AboutGalleryPlugin": {"id", "image", "alt_text", "caption", "order"},
}

ONE_PIXEL_GIF = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00"
    b"\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00"
    b"\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
)


@override_settings(ALLOWED_HOSTS=["testserver"])
class HeadlessAboutCmsTests(TestCase):
    @classmethod
    def setUpClass(cls):
        cls._temporary_media = TemporaryDirectory()
        cls._media_override = override_settings(MEDIA_ROOT=cls._temporary_media.name)
        cls._media_override.enable()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        try:
            super().tearDownClass()
        finally:
            cls._media_override.disable()
            cls._temporary_media.cleanup()

    def setUp(self):
        self.client = APIClient()
        call_command("ensure_about_cms_page", verbosity=0)
        self.page = Page.objects.get(reverse_id=settings.ABOUT_CMS_REVERSE_ID)
        self.page_content = PageContent.objects.get(
            page=self.page,
            language=settings.CMS_CONTENT_LANGUAGE,
        )
        self.placeholder = self.page_content.placeholders.get(slot="content")

    @staticmethod
    def _image(name):
        return SimpleUploadedFile(name, ONE_PIXEL_GIF, content_type="image/gif")

    def _create_complete_about_content(self):
        hero = add_plugin(
            self.placeholder,
            "AboutHeroPlugin",
            settings.CMS_CONTENT_LANGUAGE,
            eyebrow="درباره ما",
            title="مجتمع بعثت",
            subtitle="معرفی رسمی",
            background_image=self._image("hero.gif"),
            image_alt="نمای مجتمع",
            cta_label="تماس با ما",
            cta_url="https://example.com/contact",
        )

        rich_text = add_plugin(
            self.placeholder,
            "AboutRichTextPlugin",
            settings.CMS_CONTENT_LANGUAGE,
            heading="معرفی",
            body_html=(
                '<p>متن امن</p><script>alert("x")</script>'
                '<a href="mailto:unsafe@example.com">unsafe</a>'
                '<a href="/relative">relative</a>'
                '<a href="https://example.com/about">safe</a>'
            ),
        )

        history = add_plugin(
            self.placeholder,
            "AboutHistoryPlugin",
            settings.CMS_CONTENT_LANGUAGE,
            heading="تاریخچه",
            intro="مسیر رشد مجموعه",
        )
        AboutHistoryItem.objects.create(
            plugin=history,
            year="۱۳۷۲",
            title="آغاز فعالیت",
            description="شروع رسمی مجموعه",
            order=1,
        )

        founders = add_plugin(
            self.placeholder,
            "AboutFoundersPlugin",
            settings.CMS_CONTENT_LANGUAGE,
            heading="بنیان‌گذاران",
            intro="افراد مؤسس مجموعه",
        )
        AboutFounderItem.objects.create(
            plugin=founders,
            full_name="نام رسمی",
            role="بنیان‌گذار",
            bio="شرح معرفی",
            image=self._image("founder.gif"),
            image_alt="تصویر بنیان‌گذار",
            order=1,
        )

        values = add_plugin(
            self.placeholder,
            "AboutValuesPlugin",
            settings.CMS_CONTENT_LANGUAGE,
            heading="ارزش‌ها",
            intro="اصول محوری مجموعه",
        )
        AboutValueItem.objects.create(
            plugin=values,
            title="صداقت",
            description="ارزش محوری",
            icon="★",
            order=1,
        )

        goals = add_plugin(
            self.placeholder,
            "AboutGoalsPlugin",
            settings.CMS_CONTENT_LANGUAGE,
            heading="اهداف",
            intro="برنامه‌های آینده",
        )
        AboutGoalItem.objects.create(
            plugin=goals,
            title="رشد علمی",
            description="هدف رسمی",
            order=1,
        )

        gallery = add_plugin(
            self.placeholder,
            "AboutGalleryPlugin",
            settings.CMS_CONTENT_LANGUAGE,
            heading="گالری",
            intro="تصاویر مجموعه",
        )
        AboutGalleryItem.objects.create(
            plugin=gallery,
            image=self._image("gallery.gif"),
            alt_text="نمای مدرسه",
            caption="نمای مجموعه",
            order=1,
        )

        video = add_plugin(
            self.placeholder,
            "AboutVideoPlugin",
            settings.CMS_CONTENT_LANGUAGE,
            heading="ویدئوی معرفی",
            video_url="https://www.aparat.com/v/example",
            poster=self._image("poster.gif"),
            caption="معرفی تصویری مجموعه",
            autoplay=False,
        )

        return {
            "hero": hero,
            "rich_text": rich_text,
            "history": history,
            "founders": founders,
            "values": values,
            "goals": goals,
            "gallery": gallery,
            "video": video,
        }

    def _get_headless_content(self):
        response = self.client.get(
            f"/api/headless-cms/{settings.CMS_CONTENT_LANGUAGE}/pages/about/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("placeholders", response.data)
        self.assertEqual(len(response.data["placeholders"]), 1)

        placeholder_payload = response.data["placeholders"][0]
        self.assertEqual(placeholder_payload["slot"], "content")
        self.assertEqual(
            placeholder_payload["language"],
            settings.CMS_CONTENT_LANGUAGE,
        )
        self.assertIn("content", placeholder_payload)

        return placeholder_payload["content"]

    def test_management_command_creates_exact_about_slug_and_is_idempotent(self):
        self.assertEqual(self.page.get_path(settings.CMS_CONTENT_LANGUAGE), "about")
        self.assertFalse(self.page.login_required)
        self.assertFalse(self.page_content.in_navigation)

        self.page.urls.filter(language=settings.CMS_CONTENT_LANGUAGE).update(
            slug="wrong-about-path",
            path="wrong-about-path",
        )
        call_command("ensure_about_cms_page", verbosity=0)
        self.page.refresh_from_db()

        self.assertEqual(
            Page.objects.filter(reverse_id=settings.ABOUT_CMS_REVERSE_ID).count(),
            1,
        )
        self.assertEqual(self.page.get_path(settings.CMS_CONTENT_LANGUAGE), "about")

    def test_management_command_fails_safely_for_conflicting_about_pages(self):
        self.page.reverse_id = "legacy-about"
        self.page.save(update_fields=["reverse_id"])
        conflicting_page = create_page(
            title="Conflicting About",
            template=settings.ABOUT_CMS_TEMPLATE,
            language=settings.CMS_CONTENT_LANGUAGE,
            slug="conflicting-about",
            reverse_id=settings.ABOUT_CMS_REVERSE_ID,
            in_navigation=False,
        )

        with self.assertRaisesMessage(
            CommandError,
            "reverse ID and /about slug belong to different pages",
        ):
            call_command("ensure_about_cms_page", verbosity=0)

        self.page.refresh_from_db()
        conflicting_page.refresh_from_db()
        self.assertEqual(self.page.get_path(settings.CMS_CONTENT_LANGUAGE), "about")
        self.assertEqual(conflicting_page.reverse_id, settings.ABOUT_CMS_REVERSE_ID)

    def test_all_requested_plugins_are_registered(self):
        self.assertTrue(set(EXPECTED_PLUGIN_TYPES).issubset(plugin_pool.plugins.keys()))

    def test_headless_api_serializes_all_plugins_without_frontend_dependencies(self):
        created = self._create_complete_about_content()
        content = self._get_headless_content()

        actual_plugin_types = [plugin["plugin_type"] for plugin in content]
        self.assertEqual(actual_plugin_types, list(EXPECTED_PLUGIN_TYPES))

        payload_by_type = {plugin["plugin_type"]: plugin for plugin in content}

        for plugin_type, expected_fields in EXPECTED_PLUGIN_FIELDS.items():
            with self.subTest(plugin_type=plugin_type):
                missing_fields = expected_fields - set(payload_by_type[plugin_type].keys())
                self.assertFalse(
                    missing_fields,
                    f"Missing fields in {plugin_type}: {sorted(missing_fields)}",
                )

        for plugin_type, expected_item_fields in EXPECTED_ITEM_FIELDS.items():
            with self.subTest(plugin_type=plugin_type, payload="items"):
                items = payload_by_type[plugin_type]["items"]
                self.assertEqual(len(items), 1)
                missing_fields = expected_item_fields - set(items[0].keys())
                self.assertFalse(
                    missing_fields,
                    f"Missing item fields in {plugin_type}: {sorted(missing_fields)}",
                )

        hero_payload = payload_by_type["AboutHeroPlugin"]
        self.assertEqual(hero_payload["title"], "مجتمع بعثت")
        self.assertEqual(hero_payload["cta_url"], "https://example.com/contact")
        self.assertTrue(
            hero_payload["background_image"].startswith("http://testserver/media/")
        )

        rich_text_payload = payload_by_type["AboutRichTextPlugin"]
        self.assertIn("متن امن", rich_text_payload["body_html"])
        self.assertNotIn("<script", rich_text_payload["body_html"].lower())
        self.assertNotIn("mailto:", rich_text_payload["body_html"])
        self.assertNotIn('href="/relative"', rich_text_payload["body_html"])
        self.assertIn("https://example.com/about", rich_text_payload["body_html"])

        history_item = payload_by_type["AboutHistoryPlugin"]["items"][0]
        self.assertEqual(history_item["year"], "۱۳۷۲")
        self.assertEqual(history_item["title"], "آغاز فعالیت")

        founder_item = payload_by_type["AboutFoundersPlugin"]["items"][0]
        self.assertEqual(founder_item["full_name"], "نام رسمی")
        self.assertTrue(founder_item["image"].startswith("http://testserver/media/"))

        value_item = payload_by_type["AboutValuesPlugin"]["items"][0]
        self.assertEqual(value_item["title"], "صداقت")
        self.assertEqual(value_item["icon"], "★")

        goal_item = payload_by_type["AboutGoalsPlugin"]["items"][0]
        self.assertEqual(goal_item["title"], "رشد علمی")

        gallery_item = payload_by_type["AboutGalleryPlugin"]["items"][0]
        self.assertEqual(gallery_item["alt_text"], "نمای مدرسه")
        self.assertTrue(gallery_item["image"].startswith("http://testserver/media/"))

        video_payload = payload_by_type["AboutVideoPlugin"]
        self.assertEqual(video_payload["video_url"], "https://www.aparat.com/v/example")
        self.assertFalse(video_payload["autoplay"])
        self.assertTrue(video_payload["poster"].startswith("http://testserver/media/"))

        self.assertEqual(created["hero"].title, "مجتمع بعثت")

    def test_legacy_about_api_contract_remains_available(self):
        response = self.client.get("/api/about/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            set(response.data.keys()),
            {"title", "description", "image", "meta_description"},
        )

    def test_related_items_are_copied_when_django_cms_copies_a_plugin(self):
        source = add_plugin(
            self.placeholder,
            "AboutValuesPlugin",
            settings.CMS_CONTENT_LANGUAGE,
            heading="ارزش‌های اصلی",
        )
        AboutValueItem.objects.create(
            plugin=source,
            title="مسئولیت‌پذیری",
            order=1,
        )
        target = add_plugin(
            self.placeholder,
            "AboutValuesPlugin",
            settings.CMS_CONTENT_LANGUAGE,
            heading="نسخه کپی",
        )

        target.copy_relations(source)

        self.assertEqual(target.items.count(), 1)
        self.assertEqual(target.items.get().title, "مسئولیت‌پذیری")
        self.assertEqual(source.items.count(), 1)

    def test_django_cms_public_catch_all_is_not_mounted(self):
        response = self.client.get("/about/")

        self.assertEqual(response.status_code, 404)
