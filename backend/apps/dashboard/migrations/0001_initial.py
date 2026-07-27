from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("units", "0004_alter_schoolunit_kind"),
    ]

    operations = [
        migrations.CreateModel(
            name="Program",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="تاریخ بروزرسانی")),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True, null=True)),
                ("date", models.CharField(blank=True, max_length=100, null=True)),
                ("unit", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="programs", to="units.schoolunit")),
            ],
            options={"ordering": ("-created_at", "-id")},
        ),
        migrations.CreateModel(
            name="SchoolClass",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="تاریخ بروزرسانی")),
                ("title", models.CharField(max_length=255)),
                ("grade", models.CharField(blank=True, max_length=100, null=True)),
                ("capacity", models.PositiveIntegerField(blank=True, null=True)),
                ("unit", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="classes", to="units.schoolunit")),
            ],
            options={"ordering": ("unit_id", "title", "id")},
        ),
        migrations.CreateModel(
            name="Student",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="تاریخ بروزرسانی")),
                ("full_name", models.CharField(max_length=255)),
                ("national_code", models.CharField(blank=True, db_index=True, max_length=32, null=True)),
                ("class_title", models.CharField(blank=True, max_length=255, null=True)),
                ("parent", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="children_records", to=settings.AUTH_USER_MODEL)),
                ("unit", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="students", to="units.schoolunit")),
            ],
            options={"ordering": ("full_name", "id")},
        ),
        migrations.CreateModel(
            name="InternalMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="تاریخ بروزرسانی")),
                ("sender_name", models.CharField(max_length=255)),
                ("sender_role", models.CharField(max_length=30)),
                ("recipient_name", models.CharField(max_length=255)),
                ("recipient_role", models.CharField(blank=True, max_length=30, null=True)),
                ("subject", models.CharField(max_length=255)),
                ("body", models.TextField()),
                ("is_read", models.BooleanField(db_index=True, default=False)),
                ("recipient", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="received_internal_messages", to=settings.AUTH_USER_MODEL)),
                ("sender", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sent_internal_messages", to=settings.AUTH_USER_MODEL)),
                ("unit", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="internal_messages", to="units.schoolunit")),
            ],
            options={"ordering": ("-created_at", "-id")},
        ),
    ]
