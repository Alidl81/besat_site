from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("site_settings", "0003_alter_sitesettings_hero_image")]

    operations = [
        migrations.AddField(
            model_name="sitesettings",
            name="panel_options",
            field=models.JSONField(blank=True, default=dict, verbose_name="گزینه‌های پنل"),
        ),
    ]
