export type StructuredMediaItem = {
  id?: string;
  src: string;
  type: "image" | "video";
  title?: string;
  alt?: string;
  caption?: string;
  credit?: string;
};

export type StructuredMediaBlock = StructuredMediaItem & {
  width?: string;
  height?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function attribute(name: string, value: string | undefined) {
  return value ? ` ${name}="${escapeHtml(value)}"` : "";
}

export function safeStructuredMediaUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("/")) return value;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

export function normalizeSafeEmbedUrl(value: string | null | undefined) {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    let videoId = "";

    if (host === "youtu.be") {
      videoId = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (parsed.pathname === "/watch") videoId = parsed.searchParams.get("v") ?? "";
      else if (parsed.pathname.startsWith("/embed/")) videoId = parsed.pathname.split("/")[2] ?? "";
      else if (parsed.pathname.startsWith("/shorts/")) videoId = parsed.pathname.split("/")[2] ?? "";
    }

    if (/^[A-Za-z0-9_-]{6,}$/.test(videoId)) {
      return `https://www.youtube-nocookie.com/embed/${videoId}`;
    }

    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const segments = parsed.pathname.split("/").filter(Boolean);
      const vimeoId = host === "player.vimeo.com"
        ? segments[segments.indexOf("video") + 1]
        : segments[0];
      if (vimeoId && /^\d+$/.test(vimeoId)) {
        return `https://player.vimeo.com/video/${vimeoId}`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function buildGalleryBlockHtml(items: StructuredMediaItem[]) {
  const safeItems = items
    .map((item) => ({ ...item, src: safeStructuredMediaUrl(item.src) }))
    .filter((item): item is StructuredMediaItem & { src: string } => Boolean(item.src));

  const cards = safeItems.map((item) => (
    `<div data-besat-gallery-item data-type="${item.type}" data-src="${escapeHtml(item.src)}"${attribute("data-id", item.id)}${attribute("data-title", item.title)}${attribute("data-alt", item.alt)}${attribute("data-caption", item.caption)}${attribute("data-credit", item.credit)}></div>`
  )).join("");

  return `<section data-besat-block="gallery" class="my-8">${cards}</section>`;
}

export function buildMediaBlockHtml(item: StructuredMediaBlock) {
  const src = safeStructuredMediaUrl(item.src);
  if (!src) return "";
  const type = item.type === "video" ? "video" : "image";
  const media = type === "video"
    ? `<video src="${escapeHtml(src)}" controls preload="metadata"></video>`
    : `<img src="${escapeHtml(src)}" alt="${escapeHtml(item.alt ?? item.title ?? "")}" />`;
  const caption = item.caption ?? item.title ?? "";

  return `<figure data-besat-block="media" data-src="${escapeHtml(src)}" data-media-type="${type}"${attribute("data-id", item.id)}${attribute("data-title", item.title)}${attribute("data-alt", item.alt)}${attribute("data-caption", caption)}${attribute("data-credit", item.credit)}${attribute("data-width", item.width)}${attribute("data-height", item.height)}>${media}${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}${item.credit ? `<cite>${escapeHtml(item.credit)}</cite>` : ""}</figure>`;
}

export function buildQuoteBlockHtml(text: string, cite?: string) {
  const safeText = text.trim();
  if (!safeText) return "";
  const safeCite = cite?.trim() ?? "";
  return `<blockquote data-besat-block="quote" data-text="${escapeHtml(safeText)}"${attribute("data-cite", safeCite)}><p>${escapeHtml(safeText)}</p>${safeCite ? `<cite>${escapeHtml(safeCite)}</cite>` : ""}</blockquote>`;
}

export function buildCalloutBlockHtml(
  title: string,
  body: string,
  cite?: string,
  tone: "info" | "warning" | "success" = "info",
) {
  const safeBody = body.trim();
  if (!safeBody) return "";
  const safeTitle = title.trim();
  const safeCite = cite?.trim() ?? "";
  return `<section data-besat-block="callout" data-tone="${tone}"${attribute("data-title", safeTitle)} data-body="${escapeHtml(safeBody)}"${attribute("data-cite", safeCite)}>${safeTitle ? `<h3>${escapeHtml(safeTitle)}</h3>` : ""}<p>${escapeHtml(safeBody)}</p>${safeCite ? `<cite>${escapeHtml(safeCite)}</cite>` : ""}</section>`;
}

export function buildEmbedBlockHtml(url: string, title: string, caption?: string) {
  const src = normalizeSafeEmbedUrl(url);
  if (!src) return "";
  const safeTitle = title.trim() || "ویدئوی درج‌شده";
  const safeCaption = caption?.trim() ?? "";
  return `<figure data-besat-block="embed" data-src="${escapeHtml(src)}" data-title="${escapeHtml(safeTitle)}"${attribute("data-caption", safeCaption)}><iframe src="${escapeHtml(src)}" title="${escapeHtml(safeTitle)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>${safeCaption ? `<figcaption>${escapeHtml(safeCaption)}</figcaption>` : ""}</figure>`;
}
