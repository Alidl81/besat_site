from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shop", "0006_alter_cartitem_recent_add_request_ids"),
    ]

    operations = [
        migrations.AddField(
            model_name="shopcategory",
            name="is_internal",
            field=models.BooleanField(
                db_index=True,
                default=False,
                verbose_name="رکورد داخلی/آزمایشی؟",
            ),
        ),
        migrations.AddField(
            model_name="product",
            name="is_internal",
            field=models.BooleanField(
                db_index=True,
                default=False,
                verbose_name="رکورد داخلی/آزمایشی؟",
            ),
        ),
    ]
