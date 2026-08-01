import { apiRequest } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";

export type AboutInfo = {
  title: string | null;
  description: string | null;
  image: string | null;
  meta_description: string | null;
};

type CmsPluginBase = {
  id: number | string | null;
  plugin_type: string;
};

export type AboutHeroPlugin = CmsPluginBase & {
  plugin_type: "AboutHeroPlugin";
  eyebrow: string;
  title: string;
  subtitle: string;
  background_image: string | null;
  image_alt: string;
  cta_label: string;
  cta_url: string;
};

export type AboutRichTextPlugin = CmsPluginBase & {
  plugin_type: "AboutRichTextPlugin";
  heading: string;
  body_html: string;
};

export type AboutHistoryPlugin = CmsPluginBase & {
  plugin_type: "AboutHistoryPlugin";
  heading: string;
  intro: string;
  items: Array<{
    id: number | string | null;
    year: string;
    title: string;
    description: string;
    order: number;
  }>;
};

export type AboutFoundersPlugin = CmsPluginBase & {
  plugin_type: "AboutFoundersPlugin";
  heading: string;
  intro: string;
  items: Array<{
    id: number | string | null;
    full_name: string;
    role: string;
    bio: string;
    image: string | null;
    image_alt: string;
    order: number;
  }>;
};

export type AboutValuesPlugin = CmsPluginBase & {
  plugin_type: "AboutValuesPlugin";
  heading: string;
  intro: string;
  items: Array<{
    id: number | string | null;
    title: string;
    description: string;
    icon: string;
    order: number;
  }>;
};

export type AboutGoalsPlugin = CmsPluginBase & {
  plugin_type: "AboutGoalsPlugin";
  heading: string;
  intro: string;
  items: Array<{
    id: number | string | null;
    title: string;
    description: string;
    order: number;
  }>;
};

export type AboutGalleryPlugin = CmsPluginBase & {
  plugin_type: "AboutGalleryPlugin";
  heading: string;
  intro: string;
  items: Array<{
    id: number | string | null;
    image: string | null;
    alt_text: string;
    caption: string;
    order: number;
  }>;
};

export type AboutVideoPlugin = CmsPluginBase & {
  plugin_type: "AboutVideoPlugin";
  heading: string;
  video_url: string;
  poster: string | null;
  caption: string;
  autoplay: boolean;
};

export type AboutCmsPlugin =
  | AboutHeroPlugin
  | AboutRichTextPlugin
  | AboutHistoryPlugin
  | AboutFoundersPlugin
  | AboutValuesPlugin
  | AboutGoalsPlugin
  | AboutGalleryPlugin
  | AboutVideoPlugin;

export type AboutCmsPage = {
  title: string;
  page_title: string;
  meta_description: string;
  path: string;
  changed_date: string | null;
  plugins: AboutCmsPlugin[];
};

export type ResolvedAboutPage =
  | { source: "django-cms"; page: AboutCmsPage }
  | { source: "legacy"; page: AboutInfo; cmsError: string | null };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asId(value: unknown) {
  return typeof value === "number" || typeof value === "string" ? value : null;
}

function asOrder(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function records(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function normalizePlugin(raw: UnknownRecord): AboutCmsPlugin | null {
  const pluginType = asString(raw.plugin_type);
  const base = { id: asId(raw.id), plugin_type: pluginType };

  switch (pluginType) {
    case "AboutHeroPlugin": {
      const title = asString(raw.title).trim();
      if (!title) return null;
      return {
        ...base,
        plugin_type: pluginType,
        eyebrow: asString(raw.eyebrow),
        title,
        subtitle: asString(raw.subtitle),
        background_image: asNullableString(raw.background_image),
        image_alt: asString(raw.image_alt),
        cta_label: asString(raw.cta_label),
        cta_url: asString(raw.cta_url),
      };
    }
    case "AboutRichTextPlugin": {
      const bodyHtml = asString(raw.body_html).trim();
      if (!bodyHtml) return null;
      return {
        ...base,
        plugin_type: pluginType,
        heading: asString(raw.heading),
        body_html: bodyHtml,
      };
    }
    case "AboutHistoryPlugin":
      return {
        ...base,
        plugin_type: pluginType,
        heading: asString(raw.heading, "تاریخچه"),
        intro: asString(raw.intro),
        items: records(raw.items).map((item) => ({
          id: asId(item.id),
          year: asString(item.year),
          title: asString(item.title),
          description: asString(item.description),
          order: asOrder(item.order),
        })),
      };
    case "AboutFoundersPlugin":
      return {
        ...base,
        plugin_type: pluginType,
        heading: asString(raw.heading, "بنیان‌گذاران"),
        intro: asString(raw.intro),
        items: records(raw.items).map((item) => ({
          id: asId(item.id),
          full_name: asString(item.full_name),
          role: asString(item.role),
          bio: asString(item.bio),
          image: asNullableString(item.image),
          image_alt: asString(item.image_alt),
          order: asOrder(item.order),
        })),
      };
    case "AboutValuesPlugin":
      return {
        ...base,
        plugin_type: pluginType,
        heading: asString(raw.heading, "ارزش‌ها"),
        intro: asString(raw.intro),
        items: records(raw.items).map((item) => ({
          id: asId(item.id),
          title: asString(item.title),
          description: asString(item.description),
          icon: asString(item.icon),
          order: asOrder(item.order),
        })),
      };
    case "AboutGoalsPlugin":
      return {
        ...base,
        plugin_type: pluginType,
        heading: asString(raw.heading, "اهداف"),
        intro: asString(raw.intro),
        items: records(raw.items).map((item) => ({
          id: asId(item.id),
          title: asString(item.title),
          description: asString(item.description),
          order: asOrder(item.order),
        })),
      };
    case "AboutGalleryPlugin":
      return {
        ...base,
        plugin_type: pluginType,
        heading: asString(raw.heading, "گالری"),
        intro: asString(raw.intro),
        items: records(raw.items).map((item) => ({
          id: asId(item.id),
          image: asNullableString(item.image),
          alt_text: asString(item.alt_text),
          caption: asString(item.caption),
          order: asOrder(item.order),
        })),
      };
    case "AboutVideoPlugin": {
      const videoUrl = asString(raw.video_url).trim();
      if (!videoUrl) return null;
      return {
        ...base,
        plugin_type: pluginType,
        heading: asString(raw.heading),
        video_url: videoUrl,
        poster: asNullableString(raw.poster),
        caption: asString(raw.caption),
        autoplay: raw.autoplay === true,
      };
    }
    default:
      return null;
  }
}

export function parseDjangoCmsAboutResponse(payload: unknown): AboutCmsPage {
  if (!isRecord(payload)) throw new Error("Invalid django CMS page payload.");

  const placeholders = records(payload.placeholders);
  const contentPlaceholder =
    placeholders.find((placeholder) => placeholder.slot === "content") ?? placeholders[0];
  const plugins = records(contentPlaceholder?.content)
    .map(normalizePlugin)
    .filter((plugin): plugin is AboutCmsPlugin => plugin !== null);

  if (!plugins.length) throw new Error("The django CMS about page has no supported plugins.");

  return {
    title: asString(payload.title, "درباره ما"),
    page_title: asString(payload.page_title, asString(payload.title, "درباره ما")),
    meta_description: asString(payload.meta_description),
    path: asString(payload.path, "about"),
    changed_date: asNullableString(payload.changed_date),
    plugins,
  };
}

function isEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function getCmsApiBaseUrl() {
  return (
    process.env.DJANGO_CMS_API_BASE_URL ??
    "http://127.0.0.1:8000/api/headless-cms"
  ).replace(/\/$/, "");
}

async function fetchLegacyAboutPage() {
  const directUrl = process.env.ABOUT_FALLBACK_API_URL;
  if (!directUrl) return getAboutInfo();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(directUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AboutPage fallback returned HTTP ${response.status}.`);
    }

    return (await response.json()) as AboutInfo;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDjangoCmsAboutPage() {
  const language = process.env.DJANGO_CMS_ABOUT_LANGUAGE ?? "fa-ir";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `${getCmsApiBaseUrl()}/${encodeURIComponent(language)}/pages/about/`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`django CMS returned HTTP ${response.status}.`);
    }

    return response.json() as Promise<unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

export function getAboutInfo() {
  return apiRequest<AboutInfo>(apiEndpoints.about, { cache: "no-store" });
}

export async function resolveAboutPage({
  useCms,
  fetchCms,
  fetchLegacy,
  onCmsError,
}: {
  useCms: boolean;
  fetchCms: () => Promise<unknown>;
  fetchLegacy: () => Promise<AboutInfo>;
  onCmsError?: (error: unknown) => void;
}): Promise<ResolvedAboutPage> {
  if (useCms) {
    try {
      return {
        source: "django-cms",
        page: parseDjangoCmsAboutResponse(await fetchCms()),
      };
    } catch (error) {
      onCmsError?.(error);
      const legacy = await fetchLegacy();
      return {
        source: "legacy",
        page: legacy,
        cmsError: error instanceof Error ? error.message : "Unknown django CMS error.",
      };
    }
  }

  return {
    source: "legacy",
    page: await fetchLegacy(),
    cmsError: null,
  };
}

export function getResolvedAboutPage() {
  return resolveAboutPage({
    useCms: isEnabled(process.env.USE_DJANGO_CMS_ABOUT),
    fetchCms: fetchDjangoCmsAboutPage,
    fetchLegacy: fetchLegacyAboutPage,
    onCmsError: (error) => {
      console.warn(
        "[about] django CMS is unavailable; rendering the existing AboutPage API fallback.",
        error instanceof Error ? error.message : error,
      );
    },
  });
}
