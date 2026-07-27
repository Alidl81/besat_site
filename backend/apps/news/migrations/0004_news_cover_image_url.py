from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("news", "0003_alter_newscategory_options_news_is_active_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="news",
            name="cover_image_url",
            field=models.TextField(blank=True, null=True, verbose_name="نشانی تصویر کاور"),
        ),
    ]
