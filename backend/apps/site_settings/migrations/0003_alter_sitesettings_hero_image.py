from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("site_settings", "0002_sitesettings_intro_text"),
    ]

    operations = [
        migrations.AlterField(
            model_name="sitesettings",
            name="hero_image",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="site/settings/hero/",
                verbose_name="تصویر hero",
            ),
        ),
    ]
