from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("registration", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="registrationrequest",
            name="parent_full_name",
            field=models.CharField(
                blank=True,
                max_length=255,
                null=True,
                verbose_name="نام و نام خانوادگی ولی",
            ),
        ),
    ]
