from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("home", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="homeslide",
            name="image_url",
            field=models.TextField(
                blank=True,
                help_text="مسیر داخلی، URL کامل یا data URL ارسال‌شده از فرانت‌اند.",
                null=True,
                verbose_name="نشانی تصویر",
            ),
        ),
    ]
