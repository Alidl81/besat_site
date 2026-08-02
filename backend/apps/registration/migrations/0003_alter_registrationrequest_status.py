from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("registration", "0002_registrationrequest_parent_full_name_optional"),
    ]

    operations = [
        migrations.AlterField(
            model_name="registrationrequest",
            name="status",
            field=models.CharField(
                choices=[
                    ("new", "جدید"),
                    ("reviewing", "در حال بررسی"),
                    ("needs_documents", "نیازمند مدارک"),
                    ("contacted", "تماس گرفته‌شده"),
                    ("accepted", "پذیرفته‌شده"),
                    ("rejected", "ردشده"),
                    ("archived", "آرشیوشده"),
                ],
                db_index=True,
                default="new",
                max_length=20,
                verbose_name="وضعیت",
            ),
        ),
    ]
