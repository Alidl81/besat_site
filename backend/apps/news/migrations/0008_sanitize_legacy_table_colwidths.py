import json

from django.db import migrations


def sanitize_colwidths(apps, schema_editor):
    # CMS-TABLE-FORGED-COLWIDTH-001-R1: validate_tiptap_document() now
    # sanitizes colwidth on every save going forward, but any row already
    # sitting in the database before this fix (or written some other way
    # that skipped full_clean()) still carries whatever forged value was
    # in it. Reusing the same sanitizer the fix itself uses -- rather than
    # duplicating its logic here -- keeps this reconciliation pass
    # identical to what a fresh save would now produce; only rows whose
    # document actually changes are written back, to avoid a needless
    # touch on every News row.
    from apps.content.rich_text import sanitize_stored_tiptap_document

    News = apps.get_model("news", "News")
    for item in News.objects.exclude(editor_json__isnull=True).iterator():
        before = json.dumps(item.editor_json, sort_keys=True)
        sanitized = sanitize_stored_tiptap_document(item.editor_json)
        if json.dumps(sanitized, sort_keys=True) != before:
            item.editor_json = sanitized
            item.save(update_fields=["editor_json"])


class Migration(migrations.Migration):
    dependencies = [
        ("news", "0007_news_canonical_url_news_focus_keyphrase_and_more"),
    ]

    operations = [
        migrations.RunPython(sanitize_colwidths, migrations.RunPython.noop),
    ]
