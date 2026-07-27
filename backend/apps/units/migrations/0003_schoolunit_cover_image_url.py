from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("units", "0002_schoolunit_gender_schoolunit_kind"),
    ]

    operations = [
        migrations.AddField(
            model_name="schoolunit",
            name="cover_image_url",
            field=models.CharField(
                blank=True,
                help_text="برای سازگاری با تصاویر مدیریت‌شده توسط فرانت‌اند.",
                max_length=2000,
                null=True,
                verbose_name="نشانی تصویر کاور",
            ),
        ),
    ]
