from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("departments", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="department",
            name="cover_image_url",
            field=models.CharField(
                blank=True,
                max_length=2000,
                null=True,
                verbose_name="نشانی تصویر کاور",
            ),
        ),
    ]
