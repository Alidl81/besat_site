from cms.plugin_base import CMSPluginBase
from cms.plugin_pool import plugin_pool
from django.contrib import admin

from .models import (
    AboutFounderItem,
    AboutFounders,
    AboutGallery,
    AboutGalleryItem,
    AboutGoalItem,
    AboutGoals,
    AboutHero,
    AboutHistory,
    AboutHistoryItem,
    AboutRichText,
    AboutValueItem,
    AboutValues,
    AboutVideo,
)
from .serializers import (
    AboutFoundersPluginSerializer,
    AboutGalleryPluginSerializer,
    AboutGoalsPluginSerializer,
    AboutHeroPluginSerializer,
    AboutHistoryPluginSerializer,
    AboutRichTextPluginSerializer,
    AboutValuesPluginSerializer,
    AboutVideoPluginSerializer,
)


class OrderedInline(admin.StackedInline):
    extra = 0
    ordering = ("order", "id")


class AboutHistoryItemInline(OrderedInline):
    model = AboutHistoryItem


class AboutFounderItemInline(OrderedInline):
    model = AboutFounderItem


class AboutValueItemInline(OrderedInline):
    model = AboutValueItem


class AboutGoalItemInline(OrderedInline):
    model = AboutGoalItem


class AboutGalleryItemInline(OrderedInline):
    model = AboutGalleryItem


class AboutPluginBase(CMSPluginBase):
    module = "درباره ما"
    render_template = "about/cms/plugin_preview.html"
    cache = False
    allow_children = False


@plugin_pool.register_plugin
class AboutHeroPlugin(AboutPluginBase):
    model = AboutHero
    name = "Hero"
    serializer_class = AboutHeroPluginSerializer


@plugin_pool.register_plugin
class AboutRichTextPlugin(AboutPluginBase):
    model = AboutRichText
    name = "Rich Text"
    serializer_class = AboutRichTextPluginSerializer


@plugin_pool.register_plugin
class AboutHistoryPlugin(AboutPluginBase):
    model = AboutHistory
    name = "History"
    serializer_class = AboutHistoryPluginSerializer
    inlines = (AboutHistoryItemInline,)


@plugin_pool.register_plugin
class AboutFoundersPlugin(AboutPluginBase):
    model = AboutFounders
    name = "Founders"
    serializer_class = AboutFoundersPluginSerializer
    inlines = (AboutFounderItemInline,)


@plugin_pool.register_plugin
class AboutValuesPlugin(AboutPluginBase):
    model = AboutValues
    name = "Values"
    serializer_class = AboutValuesPluginSerializer
    inlines = (AboutValueItemInline,)


@plugin_pool.register_plugin
class AboutGoalsPlugin(AboutPluginBase):
    model = AboutGoals
    name = "Goals"
    serializer_class = AboutGoalsPluginSerializer
    inlines = (AboutGoalItemInline,)


@plugin_pool.register_plugin
class AboutGalleryPlugin(AboutPluginBase):
    model = AboutGallery
    name = "Gallery"
    serializer_class = AboutGalleryPluginSerializer
    inlines = (AboutGalleryItemInline,)


@plugin_pool.register_plugin
class AboutVideoPlugin(AboutPluginBase):
    model = AboutVideo
    name = "Video"
    serializer_class = AboutVideoPluginSerializer
