from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("dashboard", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="PanelService",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="تاریخ بروزرسانی")),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True, null=True)),
                ("icon", models.CharField(default="link", max_length=100)),
                ("url", models.URLField(max_length=500)),
                ("is_external", models.BooleanField(default=False)),
                ("audiences", models.JSONField(blank=True, default=list)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("order", models.PositiveIntegerField(default=0)),
            ],
            options={"ordering": ("order", "title", "id")},
        ),
    ]
