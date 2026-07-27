from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("units", "0003_schoolunit_cover_image_url"),
    ]

    operations = [
        migrations.AlterField(
            model_name="schoolunit",
            name="kind",
            field=models.TextField(
                choices=[
                    ("preschool", "پیش دبستانی"),
                    ("elementary", "دبستان"),
                    ("middle_school", "متوسطه اول"),
                    ("high_school", "دبیرستان"),
                ],
                db_index=True,
                default="elementary",
                max_length=30,
                verbose_name="نوع واحد",
            ),
        ),
    ]
