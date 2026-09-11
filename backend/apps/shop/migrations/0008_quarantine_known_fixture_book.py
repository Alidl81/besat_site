from django.db import migrations


def quarantine_known_fixture_book(apps, schema_editor):
    """Remove the audited gibberish fixture from the public catalog.

    This is deliberately guarded by the exact audited copy as well as the
    slug, so a future, legitimately authored product using the same Persian
    slug is not silently quarantined after its content has been corrected.
    """

    Product = apps.get_model("shop", "Product")
    Product.objects.filter(
        slug="کتاب",
        short_description="بیسبیس",
        description__startswith="<p></p><p>بقثبزیرفقربفقاذقربییلذ",
    ).update(is_internal=True, status="draft", published_at=None)


def restore_noop(apps, schema_editor):
    # Data was intentionally quarantined; restoring it on rollback would
    # re-expose the audited fixture to public reads.
    return None


class Migration(migrations.Migration):
    dependencies = [("shop", "0007_publication_boundary")]

    operations = [
        migrations.RunPython(quarantine_known_fixture_book, restore_noop),
    ]
