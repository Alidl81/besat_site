from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("gallery", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="galleryitem",
            name="album",
            field=models.CharField(blank=True, max_length=255, null=True, verbose_name="آلبوم"),
        ),
        migrations.AddField(
            model_name="galleryitem",
            name="media_url",
            field=models.TextField(
                blank=True,
                help_text="مسیر، URL یا data URL عکس/ویدیو ارسال‌شده از فرانت‌اند.",
                null=True,
                verbose_name="نشانی مدیا",
            ),
        ),
    ]
