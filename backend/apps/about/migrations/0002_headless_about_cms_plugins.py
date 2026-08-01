# Generated for the headless django CMS About page.

import apps.about.models
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cms", "0001_initial"),
        ("about", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="AboutFounders",
            fields=[
                (
                    "cmsplugin_ptr",
                    models.OneToOneField(
                        auto_created=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        parent_link=True,
                        primary_key=True,
                        serialize=False,
                        to="cms.cmsplugin",
                    ),
                ),
                ("heading", models.CharField(default="بنیان‌گذاران", max_length=255, verbose_name="عنوان بخش")),
                ("intro", models.TextField(blank=True, verbose_name="مقدمه")),
            ],
            options={
                "verbose_name": "بنیان‌گذاران درباره ما",
                "verbose_name_plural": "بنیان‌گذاران درباره ما",
            },
            bases=("cms.cmsplugin",),
        ),
        migrations.CreateModel(
            name="AboutGallery",
            fields=[
                (
                    "cmsplugin_ptr",
                    models.OneToOneField(
                        auto_created=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        parent_link=True,
                        primary_key=True,
                        serialize=False,
                        to="cms.cmsplugin",
                    ),
                ),
                ("heading", models.CharField(default="گالری", max_length=255, verbose_name="عنوان بخش")),
                ("intro", models.TextField(blank=True, verbose_name="مقدمه")),
            ],
            options={
                "verbose_name": "گالری درباره ما",
                "verbose_name_plural": "گالری درباره ما",
            },
            bases=("cms.cmsplugin",),
        ),
        migrations.CreateModel(
            name="AboutGoals",
            fields=[
                (
                    "cmsplugin_ptr",
                    models.OneToOneField(
                        auto_created=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        parent_link=True,
                        primary_key=True,
                        serialize=False,
                        to="cms.cmsplugin",
                    ),
                ),
                ("heading", models.CharField(default="اهداف", max_length=255, verbose_name="عنوان بخش")),
                ("intro", models.TextField(blank=True, verbose_name="مقدمه")),
            ],
            options={
                "verbose_name": "اهداف درباره ما",
                "verbose_name_plural": "اهداف درباره ما",
            },
            bases=("cms.cmsplugin",),
        ),
        migrations.CreateModel(
            name="AboutHero",
            fields=[
                (
                    "cmsplugin_ptr",
                    models.OneToOneField(
                        auto_created=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        parent_link=True,
                        primary_key=True,
                        serialize=False,
                        to="cms.cmsplugin",
                    ),
                ),
                ("eyebrow", models.CharField(blank=True, max_length=120, verbose_name="روتیتر")),
                ("title", models.CharField(max_length=255, verbose_name="عنوان")),
                ("subtitle", models.TextField(blank=True, verbose_name="زیرعنوان")),
                (
                    "background_image",
                    models.ImageField(
                        blank=True,
                        null=True,
                        upload_to=apps.about.models.about_image_upload_to,
                        verbose_name="تصویر پس‌زمینه",
                    ),
                ),
                ("image_alt", models.CharField(blank=True, max_length=255, verbose_name="متن جایگزین تصویر")),
                ("cta_label", models.CharField(blank=True, max_length=100, verbose_name="متن دکمه")),
                (
                    "cta_url",
                    models.URLField(
                        blank=True,
                        validators=[apps.about.models.validate_http_url],
                        verbose_name="لینک دکمه",
                    ),
                ),
            ],
            options={
                "verbose_name": "Hero درباره ما",
                "verbose_name_plural": "Hero درباره ما",
            },
            bases=("cms.cmsplugin",),
        ),
        migrations.CreateModel(
            name="AboutHistory",
            fields=[
                (
                    "cmsplugin_ptr",
                    models.OneToOneField(
                        auto_created=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        parent_link=True,
                        primary_key=True,
                        serialize=False,
                        to="cms.cmsplugin",
                    ),
                ),
                ("heading", models.CharField(default="تاریخچه", max_length=255, verbose_name="عنوان بخش")),
                ("intro", models.TextField(blank=True, verbose_name="مقدمه")),
            ],
            options={
                "verbose_name": "تاریخچه درباره ما",
                "verbose_name_plural": "تاریخچه درباره ما",
            },
            bases=("cms.cmsplugin",),
        ),
        migrations.CreateModel(
            name="AboutRichText",
            fields=[
                (
                    "cmsplugin_ptr",
                    models.OneToOneField(
                        auto_created=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        parent_link=True,
                        primary_key=True,
                        serialize=False,
                        to="cms.cmsplugin",
                    ),
                ),
                ("heading", models.CharField(blank=True, max_length=255, verbose_name="عنوان بخش")),
                ("body_html", models.TextField(verbose_name="محتوای HTML")),
            ],
            options={
                "verbose_name": "متن غنی درباره ما",
                "verbose_name_plural": "متن‌های غنی درباره ما",
            },
            bases=("cms.cmsplugin",),
        ),
        migrations.CreateModel(
            name="AboutValues",
            fields=[
                (
                    "cmsplugin_ptr",
                    models.OneToOneField(
                        auto_created=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        parent_link=True,
                        primary_key=True,
                        serialize=False,
                        to="cms.cmsplugin",
                    ),
                ),
                ("heading", models.CharField(default="ارزش‌ها", max_length=255, verbose_name="عنوان بخش")),
                ("intro", models.TextField(blank=True, verbose_name="مقدمه")),
            ],
            options={
                "verbose_name": "ارزش‌های درباره ما",
                "verbose_name_plural": "ارزش‌های درباره ما",
            },
            bases=("cms.cmsplugin",),
        ),
        migrations.CreateModel(
            name="AboutVideo",
            fields=[
                (
                    "cmsplugin_ptr",
                    models.OneToOneField(
                        auto_created=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        parent_link=True,
                        primary_key=True,
                        serialize=False,
                        to="cms.cmsplugin",
                    ),
                ),
                ("heading", models.CharField(blank=True, max_length=255, verbose_name="عنوان بخش")),
                (
                    "video_url",
                    models.URLField(
                        validators=[apps.about.models.validate_http_url],
                        verbose_name="آدرس ویدئو",
                    ),
                ),
                (
                    "poster",
                    models.ImageField(
                        blank=True,
                        null=True,
                        upload_to=apps.about.models.about_image_upload_to,
                        verbose_name="پوستر ویدئو",
                    ),
                ),
                ("caption", models.TextField(blank=True, verbose_name="توضیحات")),
                ("autoplay", models.BooleanField(default=False, verbose_name="پخش خودکار")),
            ],
            options={
                "verbose_name": "ویدئوی درباره ما",
                "verbose_name_plural": "ویدئوهای درباره ما",
            },
            bases=("cms.cmsplugin",),
        ),
        migrations.CreateModel(
            name="AboutValueItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255, verbose_name="عنوان")),
                ("description", models.TextField(blank=True, verbose_name="توضیحات")),
                ("icon", models.CharField(blank=True, max_length=80, verbose_name="نام آیکون")),
                ("order", models.PositiveIntegerField(default=0, verbose_name="ترتیب")),
                (
                    "plugin",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="about.aboutvalues",
                    ),
                ),
            ],
            options={
                "verbose_name": "ارزش",
                "verbose_name_plural": "ارزش‌ها",
                "ordering": ("order", "id"),
            },
        ),
        migrations.CreateModel(
            name="AboutHistoryItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("year", models.CharField(blank=True, max_length=30, verbose_name="سال/دوره")),
                ("title", models.CharField(max_length=255, verbose_name="عنوان")),
                ("description", models.TextField(blank=True, verbose_name="توضیحات")),
                ("order", models.PositiveIntegerField(default=0, verbose_name="ترتیب")),
                (
                    "plugin",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="about.abouthistory",
                    ),
                ),
            ],
            options={
                "verbose_name": "رویداد تاریخچه",
                "verbose_name_plural": "رویدادهای تاریخچه",
                "ordering": ("order", "id"),
            },
        ),
        migrations.CreateModel(
            name="AboutGoalItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255, verbose_name="عنوان")),
                ("description", models.TextField(blank=True, verbose_name="توضیحات")),
                ("order", models.PositiveIntegerField(default=0, verbose_name="ترتیب")),
                (
                    "plugin",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="about.aboutgoals",
                    ),
                ),
            ],
            options={
                "verbose_name": "هدف",
                "verbose_name_plural": "اهداف",
                "ordering": ("order", "id"),
            },
        ),
        migrations.CreateModel(
            name="AboutGalleryItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "image",
                    models.ImageField(upload_to=apps.about.models.about_image_upload_to, verbose_name="تصویر"),
                ),
                ("alt_text", models.CharField(max_length=255, verbose_name="متن جایگزین")),
                ("caption", models.CharField(blank=True, max_length=255, verbose_name="توضیح تصویر")),
                ("order", models.PositiveIntegerField(default=0, verbose_name="ترتیب")),
                (
                    "plugin",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="about.aboutgallery",
                    ),
                ),
            ],
            options={
                "verbose_name": "تصویر گالری",
                "verbose_name_plural": "تصاویر گالری",
                "ordering": ("order", "id"),
            },
        ),
        migrations.CreateModel(
            name="AboutFounderItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("full_name", models.CharField(max_length=255, verbose_name="نام و نام خانوادگی")),
                ("role", models.CharField(blank=True, max_length=150, verbose_name="سمت")),
                ("bio", models.TextField(blank=True, verbose_name="معرفی")),
                (
                    "image",
                    models.ImageField(
                        blank=True,
                        null=True,
                        upload_to=apps.about.models.about_image_upload_to,
                        verbose_name="تصویر",
                    ),
                ),
                ("image_alt", models.CharField(blank=True, max_length=255, verbose_name="متن جایگزین تصویر")),
                ("order", models.PositiveIntegerField(default=0, verbose_name="ترتیب")),
                (
                    "plugin",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="about.aboutfounders",
                    ),
                ),
            ],
            options={
                "verbose_name": "بنیان‌گذار",
                "verbose_name_plural": "بنیان‌گذاران",
                "ordering": ("order", "id"),
            },
        ),
    ]
