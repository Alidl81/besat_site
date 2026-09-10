# Hand-written (Django is not installed in this dev environment to run
# makemigrations directly; matches the exact field change made to
# apps/shop/models/cart.py's CartItem).
#
# REL-FE-CART-ADD-IDEMPOTENCY-INTERLEAVE-001: replaces the single
# last_add_request_id CharField (added in 0004, applied to the canonical
# dev DB the same session, never part of a real release) with a bounded
# JSON list of recent keys -- a single "last key" can't recognize a
# delayed retry that arrives after a different, later add already
# overwrote it. Schema-only: shop.0004 was applied and immediately
# superseded within the same development session, so there is no
# meaningful last_add_request_id data anywhere to migrate forward --
# every existing row correctly backfills recent_add_request_ids to [],
# add_item()'s documented fallback for "no key was ever supplied".

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0004_cartitem_last_add_request_id'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='cartitem',
            name='last_add_request_id',
        ),
        migrations.AddField(
            model_name='cartitem',
            name='recent_add_request_ids',
            field=models.JSONField(blank=True, default=list, verbose_name='شناسه‌های اخیر درخواست افزودن'),
        ),
    ]
