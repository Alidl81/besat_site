import json

from django.db import migrations


def sanitize_colwidths(apps, schema_editor):
    # CMS-TABLE-FORGED-COLWIDTH-001-R1: same reconciliation pass as
    # news/migrations/0008 -- see that migration's docstring for the full
    # rationale. Kept identical between the two apps intentionally.
    from apps.content.rich_text import sanitize_stored_tiptap_document

    Announcement = apps.get_model("announcements", "Announcement")
    for item in Announcement.objects.exclude(editor_json__isnull=True).iterator():
        before = json.dumps(item.editor_json, sort_keys=True)
        sanitized = sanitize_stored_tiptap_document(item.editor_json)
        if json.dumps(sanitized, sort_keys=True) != before:
            item.editor_json = sanitized
            item.save(update_fields=["editor_json"])


class Migration(migrations.Migration):
    dependencies = [
        ("announcements", "0004_announcement_canonical_url_and_more"),
    ]

    operations = [
        migrations.RunPython(sanitize_colwidths, migrations.RunPython.noop),
    ]
