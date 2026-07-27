from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("announcements", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="announcement",
            name="cover_image_url",
            field=models.TextField(blank=True, null=True, verbose_name="نشانی تصویر کاور"),
        ),
    ]
