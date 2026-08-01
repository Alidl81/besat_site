from cms.api import create_page, create_page_content
from cms.models import Page, PageContent
from django.conf import settings
from django.contrib.sites.models import Site
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Create or repair the single headless django CMS page with slug 'about'."

    @transaction.atomic
    def handle(self, *args, **options):
        language = settings.CMS_CONTENT_LANGUAGE
        site = Site.objects.get_current()

        page = (
            Page.objects.filter(site=site, reverse_id=settings.ABOUT_CMS_REVERSE_ID)
            .first()
        )
        if page is None:
            page = (
                Page.objects.filter(
                    site=site,
                    urls__language=language,
                    urls__slug="about",
                )
                .distinct()
                .first()
            )

        created = page is None
        if created:
            page = create_page(
                title="درباره ما",
                template=settings.ABOUT_CMS_TEMPLATE,
                language=language,
                slug="about",
                reverse_id=settings.ABOUT_CMS_REVERSE_ID,
                in_navigation=False,
                meta_description="درباره مجتمع تربیتی آموزشی بعثت",
                site=site,
            )
        else:
            update_fields = []
            if page.reverse_id != settings.ABOUT_CMS_REVERSE_ID:
                page.reverse_id = settings.ABOUT_CMS_REVERSE_ID
                update_fields.append("reverse_id")
            if page.login_required:
                page.login_required = False
                update_fields.append("login_required")
            if update_fields:
                page.save(update_fields=update_fields)

        page_content = PageContent.objects.filter(page=page, language=language).first()
        if page_content is None:
            page_content = create_page_content(
                language=language,
                title="درباره ما",
                page=page,
                slug="about",
                template=settings.ABOUT_CMS_TEMPLATE,
                in_navigation=False,
                meta_description="درباره مجتمع تربیتی آموزشی بعثت",
            )
        else:
            page.urls.update_or_create(
                language=language,
                defaults={
                    "slug": "about",
                    "path": "about",
                    "managed": True,
                },
            )

            content_update_fields = []
            if page_content.template != settings.ABOUT_CMS_TEMPLATE:
                page_content.template = settings.ABOUT_CMS_TEMPLATE
                content_update_fields.append("template")
            if not page_content.title:
                page_content.title = "درباره ما"
                content_update_fields.append("title")
            if page_content.in_navigation:
                page_content.in_navigation = False
                content_update_fields.append("in_navigation")
            if content_update_fields:
                page_content.save(update_fields=content_update_fields)

        page_content.rescan_placeholders()
        page._clear_internal_cache()
        action = "created" if created else "verified"
        self.stdout.write(self.style.SUCCESS(f"Headless CMS page /about was {action}."))
