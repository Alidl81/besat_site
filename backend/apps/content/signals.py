from django.db.models.signals import post_delete
from django.dispatch import receiver

from apps.announcements.models import Announcement
from apps.news.models import News

from .models import ContentRevision


@receiver(post_delete, sender=News)
def remove_news_revisions(sender, instance, **kwargs):
    ContentRevision.objects.filter(
        content_kind=ContentRevision.Kind.NEWS,
        object_id=instance.pk,
    ).delete()


@receiver(post_delete, sender=Announcement)
def remove_announcement_revisions(sender, instance, **kwargs):
    ContentRevision.objects.filter(
        content_kind=ContentRevision.Kind.ANNOUNCEMENT,
        object_id=instance.pk,
    ).delete()
