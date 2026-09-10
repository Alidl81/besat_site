import { safePublicMediaUrl } from "@/lib/media/safe-url";

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

// FE-RICH-MEDIA-PROTOCOL-RELATIVE-001: this used to accept any value
// merely starting with "/" as a same-origin local path, which also let a
// protocol-relative "//evil.example/..." through unchanged -- the browser
// resolves that against "evil.example", not this site, sending an
// unreviewed cross-origin media request (and its referrer) for untrusted
// CMS-authored rich content. isSafeRelativePath() rejects that and the
// related backslash/parser-normalization bypass variants.
//
// SEC-FE-RICH-MEDIA-PARSER-001: the absolute-URL branch had the same
// bare-`new URL()` gap already fixed in isSafeExternalHttpUrl and
// lib/media/safe-url.ts -- a backslash-scheme form like
// "http:\\evil.example/pixel.jpg" parses identically to the honest
// forward-slash form.
//
// SEC-FE-RICH-MEDIA-ORIGIN-001: this used to stop at validating the URL,
// same as safePublicMediaUrl() did before FE-PUBLIC-MEDIA-ORIGIN-001 --
// so a persisted rich-content gallery/media `src` the backend built with
// the wrong Host (e.g. an absolute "http://localhost:3000/media/..." in a
// real deployment) passed validation unchanged and was rendered as a dead
// cross-origin <img>, tripping the CSP img-src allowlist exactly like the
// public gallery/shop sinks did. Delegating entirely to the shared,
// already-fixed safePublicMediaUrl() closes both the parser bypass and the
// origin bypass here in one place instead of re-deriving either a third
// time -- every public media sink now goes through the identical
// normalization.
export function safeStructuredMediaUrl(value: string | null | undefined) {
  return safePublicMediaUrl(value);
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
