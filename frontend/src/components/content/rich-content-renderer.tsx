"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import { lockBodyScroll } from "@/lib/body-scroll-lock";
import { isTopDialog, popDialog, pushDialog } from "@/lib/dialog-stack";
import { sanitizeCmsHtml } from "@/lib/content/sanitize-cms-html";
import {
  normalizeSafeEmbedUrl,
  safeStructuredMediaUrl,
} from "@/lib/editor/structured-content";

type MediaItem = {
  src: string;
  type: "image" | "video";
  id?: string;
  title?: string;
  alt?: string;
  caption?: string;
  credit?: string;
};

type CalloutTone = "note" | "info" | "success" | "warning" | "important";
type QuoteStyle = "classic" | "accent" | "minimal";

type ContentPart =
  | {
      type: "gallery";
      items: MediaItem[];
      width: string;
      height: string;
      columns: "2" | "3" | "4" | "auto";
      gap: "compact" | "normal" | "comfortable";
      aspect: "natural" | "square" | "4:3" | "16:9";
      captions: boolean;
      lightbox: boolean;
    }
  | { type: "media"; item: MediaItem; width: string; height: string }
  | {
      type: "image";
      src: string;
      alt: string;
      align: "left" | "center" | "right";
      width: string;
      radius: "none" | "sm" | "md" | "lg";
      caption: string;
      link: string;
      lightbox: boolean;
    }
  | { type: "quote"; text: string; cite: string; style: QuoteStyle }
  | { type: "callout"; title: string; body: string; cite: string; tone: CalloutTone }
  | { type: "embed"; src: string; title: string; caption: string; aspect: "16:9" | "4:3" | "1:1" }
  | { type: "html"; html: string };

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getAttr(html: string, attr: string) {
  const match = html.match(new RegExp(attr + "=[\"']([^\"']*)[\"']", "i"));
  return match ? decodeHtml(match[1]) : "";
}

function getTagText(html: string, tag: string) {
  const match = html.match(new RegExp("<" + tag + "\\b[^>]*>([\\s\\S]*?)<\\/" + tag + ">", "i"));
  if (!match) return "";
  return decodeHtml(match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
}

function normalizeSize(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (/^\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh)$/.test(trimmed)) return trimmed;
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return trimmed + "px";
  return fallback;
}

function isVideoSource(src: string) {
  const value = src.toLowerCase();
  return value.endsWith(".mp4") || value.endsWith(".webm") || value.endsWith(".ogg")
    || value.includes(".mp4?") || value.includes(".webm?") || value.includes(".ogg?");
}

function pickEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function itemFromElementHtml(html: string): MediaItem | null {
  const src = safeStructuredMediaUrl(getAttr(html, "data-src"));
  if (!src) return null;
  const type = getAttr(html, "data-type") === "video" || isVideoSource(src)
    ? "video"
    : "image";
  return {
    src,
    type,
    id: getAttr(html, "data-id") || undefined,
    title: getAttr(html, "data-title") || undefined,
    alt: getAttr(html, "data-alt") || undefined,
    caption: getAttr(html, "data-caption") || undefined,
    credit: getAttr(html, "data-credit") || undefined,
  };
}

function extractGalleryItems(blockHtml: string) {
  const items: MediaItem[] = [];
  const entries = blockHtml.match(/<[^>]+data-besat-gallery-item[^>]*>/gi) ?? [];
  for (const entry of entries) {
    const item = itemFromElementHtml(entry);
    if (item) items.push(item);
  }
  if (items.length) return items;

  const mediaRegex = /<(img|video)\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = mediaRegex.exec(blockHtml)) !== null) {
    const src = safeStructuredMediaUrl(decodeHtml(match[2]));
    if (!src) continue;
    items.push({
      src,
      type: match[1].toLowerCase() === "video" || isVideoSource(src) ? "video" : "image",
      alt: getAttr(match[0], "alt") || undefined,
    });
  }
  return items;
}

function parseBlock(blockHtml: string): ContentPart | null {
  const block = getAttr(blockHtml, "data-besat-block");
  if (block === "gallery") {
    const items = extractGalleryItems(blockHtml);
    return items.length
      ? {
          type: "gallery",
          items,
          width: normalizeSize(getAttr(blockHtml, "data-width"), "100%"),
          height: normalizeSize(getAttr(blockHtml, "data-height"), "14rem"),
          columns: pickEnum(getAttr(blockHtml, "data-columns"), ["2", "3", "4", "auto"] as const, "auto"),
          gap: pickEnum(getAttr(blockHtml, "data-gap"), ["compact", "normal", "comfortable"] as const, "normal"),
          aspect: pickEnum(getAttr(blockHtml, "data-aspect"), ["natural", "square", "4:3", "16:9"] as const, "natural"),
          captions: getAttr(blockHtml, "data-captions") !== "false",
          lightbox: getAttr(blockHtml, "data-lightbox") !== "false",
        }
      : null;
  }

  if (block === "media") {
    const mediaTag = blockHtml.match(/<(img|video)\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
    const src = safeStructuredMediaUrl(
      getAttr(blockHtml, "data-src") || decodeHtml(mediaTag?.[2] ?? ""),
    );
    if (!src) return null;
    return {
      type: "media",
      item: {
        src,
        type: getAttr(blockHtml, "data-media-type") === "video"
          || mediaTag?.[1]?.toLowerCase() === "video"
          || isVideoSource(src)
            ? "video"
            : "image",
        id: getAttr(blockHtml, "data-id") || undefined,
        title: getAttr(blockHtml, "data-title") || undefined,
        alt: getAttr(blockHtml, "data-alt") || getAttr(mediaTag?.[0] ?? "", "alt") || undefined,
        caption: getAttr(blockHtml, "data-caption") || getTagText(blockHtml, "figcaption") || undefined,
        credit: getAttr(blockHtml, "data-credit") || getTagText(blockHtml, "cite") || undefined,
      },
      width: normalizeSize(getAttr(blockHtml, "data-width"), "100%"),
      height: normalizeSize(getAttr(blockHtml, "data-height"), "auto"),
    };
  }

  if (block === "image") {
    const imgTag = blockHtml.match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
    const src = safeStructuredMediaUrl(decodeHtml(imgTag?.[1] ?? ""));
    if (!src) return null;
    const linkMatch = blockHtml.match(/<a\b[^>]*\bhref=["']([^"']+)["']/i);
    return {
      type: "image",
      src,
      alt: getAttr(imgTag?.[0] ?? "", "alt"),
      align: pickEnum(getAttr(blockHtml, "data-align"), ["left", "center", "right"] as const, "center"),
      width: getAttr(blockHtml, "data-width"),
      radius: pickEnum(getAttr(blockHtml, "data-radius"), ["none", "sm", "md", "lg"] as const, "none"),
      caption: getTagText(blockHtml, "figcaption"),
      link: linkMatch ? decodeHtml(linkMatch[1]) : "",
      lightbox: getAttr(blockHtml, "data-lightbox") === "true",
    };
  }

  if (block === "quote") {
    const text = getAttr(blockHtml, "data-text") || getTagText(blockHtml, "p");
    return text
      ? {
          type: "quote",
          text,
          cite: getAttr(blockHtml, "data-cite") || getTagText(blockHtml, "cite"),
          style: pickEnum(getAttr(blockHtml, "data-style"), ["classic", "accent", "minimal"] as const, "classic"),
        }
      : null;
  }

  if (block === "callout") {
    return {
      type: "callout",
      title: getAttr(blockHtml, "data-title") || getTagText(blockHtml, "h3"),
      body: getAttr(blockHtml, "data-body") || getTagText(blockHtml, "p"),
      cite: getAttr(blockHtml, "data-cite") || getTagText(blockHtml, "cite"),
      tone: pickEnum(
        getAttr(blockHtml, "data-tone"),
        ["note", "info", "success", "warning", "important"] as const,
        "info",
      ),
    };
  }

  if (block === "embed") {
    const iframe = blockHtml.match(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
    const src = normalizeSafeEmbedUrl(getAttr(blockHtml, "data-src") || iframe?.[1]);
    return src
      ? {
          type: "embed",
          src,
          title: getAttr(blockHtml, "data-title") || getAttr(iframe?.[0] ?? "", "title") || "ویدئو",
          caption: getAttr(blockHtml, "data-caption") || getTagText(blockHtml, "figcaption"),
          aspect: pickEnum(getAttr(blockHtml, "data-aspect"), ["16:9", "4:3", "1:1"] as const, "16:9"),
        }
      : null;
  }

  return null;
}

function extractBlocksFrom(segment: string, parts: ContentPart[]) {
  const pattern = /<(section|figure|blockquote)\b[^>]*data-besat-block=["'](?:gallery|media|image|quote|callout|embed)["'][\s\S]*?<\/\1>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(segment)) !== null) {
    const before = segment.slice(lastIndex, match.index);
    if (before.trim()) parts.push({ type: "html", html: before });
    const part = parseBlock(match[0]);
    if (part) parts.push(part);
    lastIndex = match.index + match[0].length;
  }
  const after = segment.slice(lastIndex);
  if (after.trim()) parts.push({ type: "html", html: after });
}

// Finds the index right after the </div> that closes the <div> whose open
// tag ends at `searchFrom` (depth 1 already open), correctly skipping over
// any further <div>...</div> nested inside (e.g. a gallery item's own empty
// <div data-besat-gallery-item ...></div>) rather than stopping at the
// first </div> encountered. Returns -1 if no matching close exists.
function findMatchingDivClose(html: string, searchFrom: number): number {
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = searchFrom;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html)) !== null) {
    if (match[0].startsWith("</")) {
      depth -= 1;
      if (depth === 0) return match.index + match[0].length;
    } else {
      depth += 1;
    }
  }
  return -1;
}

function parseContent(html: string): ContentPart[] {
  const parts: ContentPart[] = [];
  // FE-CMS-TABLE-MEDIA-RENDER-001: a besat block (media/gallery/etc) nested
  // inside a table cell used to be extracted by extractBlocksFrom() the same
  // as a top-level block, splitting the table's HTML into a "before" and
  // "after" fragment rendered as two SEPARATE dangerouslySetInnerHTML nodes.
  // Each fragment is then an incomplete/mismatched table (e.g. an unclosed
  // "<table><tr><td>"), so the browser's HTML fragment parser silently drops
  // or mangles the surrounding rows/cells. The backend always emits a table
  // as one atomic `<div class="besat-table-wrapper">...<table>...</table>
  // </div>` unit (backend/apps/content/rich_text.py's only table renderer),
  // so that whole wrapper -- not just the inner <table> -- is what must stay
  // untouched; a first attempt at this fix carved out only the inner
  // <table>, which still split the wrapper's own opening/closing <div> tags
  // apart. findMatchingDivClose() walks the wrapper's actual <div> nesting
  // depth (rather than stopping at the first </div>, which could belong to
  // an unrelated self-closing nested div such as a gallery item) to find its
  // true end.
  const wrapperOpenPattern = /<div\b[^>]*\bclass=["'][^"']*\bbesat-table-wrapper\b[^"']*["'][^>]*>/gi;
  let cursor = 0;
  let openMatch: RegExpExecArray | null;
  const wrapperRanges: Array<[number, number]> = [];
  while ((openMatch = wrapperOpenPattern.exec(html)) !== null) {
    if (openMatch.index < cursor) continue;
    const closeEnd = findMatchingDivClose(html, openMatch.index + openMatch[0].length);
    if (closeEnd === -1) continue;
    wrapperRanges.push([openMatch.index, closeEnd]);
    cursor = closeEnd;
    wrapperOpenPattern.lastIndex = closeEnd;
  }

  cursor = 0;
  for (const [start, end] of wrapperRanges) {
    if (start > cursor) extractBareTables(html.slice(cursor, start), parts);
    parts.push({ type: "html", html: html.slice(start, end) });
    cursor = end;
  }
  if (cursor < html.length) extractBareTables(html.slice(cursor), parts);
  return parts.length || !html.trim() ? parts : [{ type: "html", html }];
}

// Fallback for a bare <table> with no besat-table-wrapper div around it
// (e.g. hand-authored HTML that never went through _render_table) -- tables
// can't nest in this CMS, so a plain non-greedy match is safe here.
function extractBareTables(segment: string, parts: ContentPart[]) {
  const tablePattern = /<table\b[\s\S]*?<\/table>/gi;
  let cursor = 0;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tablePattern.exec(segment)) !== null) {
    if (tableMatch.index > cursor) extractBlocksFrom(segment.slice(cursor, tableMatch.index), parts);
    if (tableMatch[0].trim()) parts.push({ type: "html", html: tableMatch[0] });
    cursor = tableMatch.index + tableMatch[0].length;
  }
  if (cursor < segment.length) extractBlocksFrom(segment.slice(cursor), parts);
}

function galleryAspectClass(aspect: "natural" | "square" | "4:3" | "16:9") {
  if (aspect === "square") return "aspect-square";
  if (aspect === "4:3") return "aspect-[4/3]";
  if (aspect === "16:9") return "aspect-video";
  return "";
}

function galleryGapClass(gap: "compact" | "normal" | "comfortable") {
  if (gap === "compact") return "gap-2";
  if (gap === "comfortable") return "gap-6";
  return "gap-4";
}

function galleryColumnsClass(columns: "2" | "3" | "4" | "auto") {
  if (columns === "2") return "sm:grid-cols-2";
  if (columns === "3") return "sm:grid-cols-2 lg:grid-cols-3";
  if (columns === "4") return "sm:grid-cols-2 lg:grid-cols-4";
  return "sm:grid-cols-2 lg:grid-cols-3";
}

function GalleryBlock({
  items,
  width,
  height,
  columns,
  gap,
  aspect,
  captions,
  lightbox,
}: {
  items: MediaItem[];
  width: string;
  height: string;
  columns: "2" | "3" | "4" | "auto";
  gap: "compact" | "normal" | "comfortable";
  aspect: "natural" | "square" | "4:3" | "16:9";
  captions: boolean;
  lightbox: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const dialogTokenRef = useRef<symbol | null>(null);
  // FE-RICH-GALLERY-LIST-SHRINK-LOCK-001 / FE-RICH-GALLERY-SHRINK-REGROW-001:
  // a re-render that shrinks `items` such that `activeIndex` no longer
  // points at a real item must actually invalidate `activeIndex` itself,
  // not just hide the dialog while leaving the stale index sitting in
  // state. An earlier version of this fix instead redefined `isOpen` as a
  // *derived* `activeIndex !== null && activeIndex < items.length`,
  // leaving `activeIndex` itself untouched -- that correctly closed the
  // dialog and released the scroll lock/dialog-stack token (isOpen's own
  // effect dependency flipped to false), but meant that if `items` later
  // grew back to include that same index (e.g. the CMS block's item list
  // changing again), the stale `activeIndex` silently became "valid" again
  // and the old lightbox reopened with no new click from the user. Nulling
  // out `activeIndex` here -- during render, the pattern React's own docs
  // recommend for "adjusting state when a prop changes" rather than doing
  // it from an effect (which would trip eslint's react-hooks/set-state-in-
  // effect, since this isn't synchronizing with an external system) --
  // means regrowth starts from a genuinely closed state, requiring a real
  // user activation to reopen.
  if (activeIndex !== null && activeIndex >= items.length) {
    setActiveIndex(null);
  }
  const isOpen = activeIndex !== null && activeIndex < items.length;
  const safeActiveIndex = isOpen ? (activeIndex as number) : 0;
  const activeItem = isOpen ? items[safeActiveIndex] : null;
  const aspectClass = galleryAspectClass(aspect);

  // FE-RICH-GALLERY-LIGHTBOX-001: scroll lock and opener-focus restoration
  // are keyed on `isOpen` (not `activeIndex`) so that navigating between
  // images with the arrow keys -- which changes `activeIndex` without
  // closing the modal -- doesn't repeatedly re-lock an already-locked body
  // or yank focus back to the gallery grid on every step. Restoration only
  // needs to happen once, when the modal actually closes.
  // FE-RICH-GALLERY-MANUAL-STACK-001: a capture-and-restore-the-prior-value
  // scroll lock (this block's previous approach) is only correct when every
  // active lock closes in the exact reverse order it opened -- it breaks
  // with two of these inline lightboxes open at once (e.g. two separate
  // CMS gallery blocks on the same page) and one closing before the other.
  // lockBodyScroll()'s shared reference count (frontend/src/lib/body-
  // scroll-lock.ts, already used by useFocusTrap/GalleryLightbox/Modal/
  // ConfirmDialog/MediaPickerDialog) stays correct for any closing order.
  useEffect(() => {
    if (!isOpen) return;
    const releaseScrollLock = lockBodyScroll();
    // FE-RICH-LIGHTBOX-ESCAPE-STACK-001: this listener used to close
    // unconditionally, with no awareness of another dialog (e.g. a CRUD
    // Modal) opened on top of it -- joins the same shared dialog-stack
    // token Modal/ConfirmDialog/useFocusTrap/GalleryLightbox already use.
    // Pushed/popped here (keyed on `isOpen`) rather than in the keydown
    // effect below (keyed on `activeIndex`) so navigating between images
    // doesn't re-push the token on every step.
    const dialogToken = pushDialog();
    dialogTokenRef.current = dialogToken;
    return () => {
      popDialog(dialogToken);
      dialogTokenRef.current = null;
      releaseScrollLock();
      openerRef.current?.focus({ preventScroll: true });
      openerRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!dialogTokenRef.current || !isTopDialog(dialogTokenRef.current)) return;
        event.preventDefault();
        setActiveIndex(null);
      } else if (event.key === "ArrowLeft" && items.length > 1) {
        // FE-RICH-GALLERY-RTL-SEMANTICS-001: this RTL lightbox must match
        // GalleryLightbox's established right="previous"/left="next"
        // screen-position mapping -- ArrowLeft (toward the visual "next"
        // button) advances, ArrowRight (toward "previous") goes back.
        event.preventDefault();
        setActiveIndex((current) => current === null ? 0 : (current + 1) % items.length);
      } else if (event.key === "ArrowRight" && items.length > 1) {
        event.preventDefault();
        setActiveIndex((current) => current === null ? 0 : (current - 1 + items.length) % items.length);
      } else if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeIndex, items.length, isOpen]);

  return (
    <>
      <div
        data-besat-rendered-block="gallery"
        className={`besat-gallery my-8 grid grid-cols-1 ${galleryColumnsClass(columns)} ${galleryGapClass(gap)}`}
        style={{ width, height, maxWidth: "100%" }}
      >
        {items.map((item, index) => {
          const media = item.type === "video" ? (
            <video
              src={item.src}
              muted
              className={`w-full rounded-[1.25rem] bg-slate-950 object-cover ${aspectClass}`}
            />
          ) : (
            <img
              src={item.src}
              alt={item.alt ?? ""}
              className={`w-full rounded-[1.25rem] bg-slate-100 object-cover ${aspectClass}`}
            />
          );
          const caption = captions && item.caption ? (
            <span className="mt-2 block text-xs font-bold leading-6 text-slate-600">{item.caption}</span>
          ) : null;

          // FE-RICH-GALLERY-NONINTERACTIVE-001: a non-lightbox gallery
          // (`data-lightbox="false"`) has nothing for a click/Enter/Space
          // activation to DO -- the old unconditional <button> exposed a
          // focusable, named control to keyboard/screen-reader users that
          // silently did nothing when activated (onClick guarded internally
          // with `if (!lightbox) return`). Rendering a plain, non-
          // interactive container instead removes the dead control by
          // construction rather than making its handler a no-op.
          if (!lightbox) {
            return (
              <div
                key={item.src + "-" + index}
                className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white p-2 text-right shadow-sm"
              >
                {media}
                {caption}
              </div>
            );
          }

          return (
            <button
              key={item.src + "-" + index}
              type="button"
              onClick={(event) => {
                openerRef.current = event.currentTarget;
                setActiveIndex(index);
              }}
              className="group overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white p-2 text-right shadow-sm transition hover:-translate-y-1 hover:border-blue-300 cursor-zoom-in"
              aria-label={item.alt || item.title || "مشاهده رسانه"}
            >
              {media}
              {caption}
            </button>
          );
        })}
      </div>
      {lightbox && activeItem ? (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveIndex(null); }}
        >
          <div role="dialog" aria-modal="true" aria-label={activeItem.title || activeItem.alt || "نمایش رسانه"} className="relative flex max-h-[90vh] w-full max-w-6xl flex-col items-center justify-center">
            <button ref={closeRef} type="button" onClick={() => setActiveIndex(null)} aria-label="بستن" className="absolute right-0 top-0 z-20 flex size-11 items-center justify-center rounded-2xl bg-white/10 text-white transition hover:bg-white/20">
              <PanelIcon name="close" className="size-5" />
            </button>
            {items.length > 1 ? (
              // FE-RICH-GALLERY-RTL-SEMANTICS-001: "previous" belongs on
              // the visual right in this RTL lightbox, matching
              // GalleryLightbox's established contract -- this button
              // used to sit here labeled "next" (index + 1), the opposite
              // of every other gallery/lightbox in the app.
              <button type="button" onClick={() => setActiveIndex((safeActiveIndex - 1 + items.length) % items.length)} className="absolute right-0 top-1/2 z-20 hidden -translate-y-1/2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/20 sm:block">قبلی</button>
            ) : null}
            <div className="w-full px-16">
              {activeItem.type === "video" ? (
                <video src={activeItem.src} controls autoPlay className="max-h-[76vh] w-full rounded-[1.5rem] bg-black object-contain" />
              ) : (
                <img src={activeItem.src} alt={activeItem.alt ?? ""} className="max-h-[76vh] w-full rounded-[1.5rem] object-contain" />
              )}
              {activeItem.caption || activeItem.credit ? (
                <p className="mx-auto mt-3 max-w-3xl text-center text-sm font-bold leading-7 text-white">
                  {activeItem.caption}
                  {activeItem.credit ? <cite className="mr-2 not-italic text-slate-300">— {activeItem.credit}</cite> : null}
                </p>
              ) : null}
            </div>
            {items.length > 1 ? (
              <button type="button" onClick={() => setActiveIndex((safeActiveIndex + 1) % items.length)} className="absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/20 sm:block">بعدی</button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function MediaBlock({ item, width, height }: { item: MediaItem; width: string; height: string }) {
  return <figure className="my-8 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm" style={{ width, maxWidth: "100%" }}>{item.type === "video" ? <video src={item.src} controls preload="metadata" className="w-full rounded-[1.1rem] bg-slate-950 object-contain" style={{ height: height === "auto" ? undefined : height }} /> : <img src={item.src} alt={item.alt ?? ""} className="w-full rounded-[1.1rem] object-cover" style={{ height: height === "auto" ? undefined : height }} />}{item.caption ? <figcaption className="px-2 pt-3 text-sm font-bold leading-7 text-slate-600">{item.caption}</figcaption> : null}{/* FE-A11Y-CONTRAST-PUBLIC-METADATA-001 (same defect pattern): text-slate-400
                on this white card measured 2.564:1, below AA's 4.5:1. slate-600
                gives real headroom (7.58:1) vs slate-500's razor-thin pass. */}
              {item.credit ? <cite className="block px-2 pt-1 text-xs font-bold not-italic text-slate-600">{item.credit}</cite> : null}</figure>;
}

const RADIUS_CLASSES: Record<"none" | "sm" | "md" | "lg", string> = {
  none: "rounded-none",
  sm: "rounded-md",
  md: "rounded-2xl",
  lg: "rounded-[1.6rem]",
};

function ImageBlock({
  src,
  alt,
  align,
  width,
  radius,
  caption,
  link,
  lightbox,
}: {
  src: string;
  alt: string;
  align: "left" | "center" | "right";
  width: string;
  radius: "none" | "sm" | "md" | "lg";
  caption: string;
  link: string;
  lightbox: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const alignClass = align === "left" ? "mr-auto" : align === "right" ? "ml-auto" : "mx-auto";
  const image = (
    <img
      src={src}
      alt={alt}
      style={width ? { width, maxWidth: "100%" } : { maxWidth: "100%" }}
      className={`${RADIUS_CLASSES[radius]} ${alignClass}`}
    />
  );

  // FE-RICH-GALLERY-LIGHTBOX-001 (scope expanded to this block): this modal
  // previously had no Escape handler, scroll lock, Tab trap, or opener-focus
  // restoration at all -- only mouse-based close. Mirrors the same fix
  // applied to GalleryBlock's inline lightbox above.
  //
  // FE-RICH-GALLERY-MANUAL-STACK-001: lockBodyScroll()'s shared reference
  // count (not a capture-and-restore-the-prior-value scheme) stays correct
  // regardless of the order concurrently open modals close in -- see
  // GalleryBlock's identical fix above for the full rationale.
  useEffect(() => {
    if (!open) return;
    const releaseScrollLock = lockBodyScroll();
    // FE-RICH-LIGHTBOX-ESCAPE-STACK-001: joins the shared dialog-stack
    // token so a Modal opened on top of this lightbox owns Escape instead
    // of both closing at once -- see GalleryBlock's identical fix above.
    const dialogToken = pushDialog();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!isTopDialog(dialogToken)) return;
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      popDialog(dialogToken);
      releaseScrollLock();
      openerRef.current?.focus({ preventScroll: true });
      openerRef.current = null;
    };
  }, [open]);

  return (
    <figure className="my-6">
      {lightbox ? (
        <button
          type="button"
          onClick={(event) => {
            openerRef.current = event.currentTarget;
            setOpen(true);
          }}
          className="block w-full cursor-zoom-in"
          style={{ textAlign: align }}
        >
          {image}
        </button>
      ) : link ? (
        <a href={link} className="block" style={{ textAlign: align }}>{image}</a>
      ) : (
        <div style={{ textAlign: align }}>{image}</div>
      )}
      {caption ? <figcaption className="mt-2 text-center text-sm font-bold leading-7 text-slate-600">{caption}</figcaption> : null}
      {lightbox && open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={alt || "نمایش تصویر"}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
        >
          <button type="button" onClick={() => setOpen(false)} aria-label="بستن" autoFocus className="absolute left-4 top-4 z-20 flex size-11 items-center justify-center rounded-2xl bg-white/10 text-white transition hover:bg-white/20">
            <PanelIcon name="close" className="size-5" />
          </button>
          <img src={src} alt={alt} className="max-h-[85vh] max-w-full rounded-2xl object-contain" />
        </div>
      ) : null}
    </figure>
  );
}

const QUOTE_STYLE_CLASSES: Record<QuoteStyle, string> = {
  classic: "border-r-4 border-[#d98712] bg-[#fff8ec] text-[#173652]",
  accent: "border border-[#082f57] bg-[#eef4f9] rounded-[1.25rem] text-[#173652]",
  minimal: "border-none bg-transparent pr-0 text-[#173652]",
};

function QuoteBlock({ text, cite, style }: { text: string; cite: string; style: QuoteStyle }) {
  return (
    <blockquote className={`my-8 px-6 py-5 text-lg font-black leading-9 ${QUOTE_STYLE_CLASSES[style]}`}>
      <p>{text}</p>
      {cite ? <cite className="mt-3 block text-sm font-bold not-italic text-slate-500">{cite}</cite> : null}
    </blockquote>
  );
}

const CALLOUT_ICON_PATHS: Record<CalloutTone, string[]> = {
  note: ["M6 4h9l3 3v13H6V4Z", "M9 9h6", "M9 13h6", "M9 17h3"],
  info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 8h.01", "M11 12h1v4h1"],
  success: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M8 12.5l2.5 2.5L16 9"],
  warning: [
    "M10.24 3.957 2.98 16.75A2 2 0 0 0 4.72 19.75h14.56a2 2 0 0 0 1.74-3L13.76 3.957a2 2 0 0 0-3.52 0Z",
    "M12 9v4",
    "M12 16h.01",
  ],
  important: ["M8.5 3h7L21 8.5v7L15.5 21h-7L3 15.5v-7L8.5 3Z", "M12 8v5", "M12 16h.01"],
};

const CALLOUT_TONE_CLASSES: Record<CalloutTone, string> = {
  note: "border-slate-300 bg-slate-50 text-slate-700",
  info: "border-blue-200 bg-blue-50 text-[#173652]",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  important: "border-rose-200 bg-rose-50 text-rose-950",
};

function CalloutBlock({ title, body, cite, tone }: { title: string; body: string; cite: string; tone: CalloutTone }) {
  return (
    <section className={"my-8 flex items-start gap-3 rounded-[1.25rem] border p-5 " + CALLOUT_TONE_CLASSES[tone]}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
        {CALLOUT_ICON_PATHS[tone].map((d) => <path key={d} d={d} />)}
      </svg>
      <div className="min-w-0">
        {title ? <h3 className="text-base font-black">{title}</h3> : null}
        <p className={title ? "mt-2 text-sm font-bold leading-8" : "text-sm font-bold leading-8"}>{body}</p>
        {cite ? <cite className="mt-2 block text-xs font-bold not-italic opacity-70">{cite}</cite> : null}
      </div>
    </section>
  );
}

const EMBED_ASPECT_CLASSES: Record<"16:9" | "4:3" | "1:1", string> = {
  "16:9": "aspect-video",
  "4:3": "aspect-[4/3]",
  "1:1": "aspect-square",
};

function EmbedBlock({ src, title, caption, aspect }: { src: string; title: string; caption: string; aspect: "16:9" | "4:3" | "1:1" }) {
  return (
    <figure className="my-8 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-950 p-2 shadow-sm">
      <div className={`overflow-hidden rounded-[1.1rem] ${EMBED_ASPECT_CLASSES[aspect]}`}>
        <iframe src={src} title={title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen className="size-full border-0" />
      </div>
      {caption ? <figcaption className="bg-white px-3 py-3 text-sm font-bold leading-7 text-slate-600">{caption}</figcaption> : null}
    </figure>
  );
}

// Progressive enhancement only: code blocks fall into the generic HTML
// bucket (dangerouslySetInnerHTML), so the copy button is wired up via
// event delegation after mount rather than as its own parsed block type.
function useCodeCopyButtons(containerRef: React.RefObject<HTMLDivElement | null>, deps: unknown[]) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleClick(event: Event) {
      const target = (event.target as HTMLElement)?.closest("[data-copy-code]");
      if (!target) return;
      const code = target.closest("pre")?.querySelector("code")?.textContent ?? "";
      void navigator.clipboard?.writeText(code).then(() => {
        const original = target.textContent;
        target.textContent = "کپی شد";
        window.setTimeout(() => { target.textContent = original; }, 1500);
      }).catch(() => undefined);
    }

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function RichContentRenderer({ html }: { html: string }) {
  const parts = useMemo(() => parseContent(sanitizeCmsHtml(html)), [html]);
  const containerRef = useRef<HTMLDivElement>(null);
  useCodeCopyButtons(containerRef, [parts]);

  return (
    <div ref={containerRef} className="besat-rich-content mt-8 max-w-none text-right text-base font-medium leading-9 text-slate-700">
      {parts.map((part, index) => {
        if (part.type === "gallery") {
          return (
            <GalleryBlock
              key={"gallery-" + index}
              items={part.items}
              width={part.width}
              height={part.height}
              columns={part.columns}
              gap={part.gap}
              aspect={part.aspect}
              captions={part.captions}
              lightbox={part.lightbox}
            />
          );
        }
        if (part.type === "media") return <MediaBlock key={"media-" + index} item={part.item} width={part.width} height={part.height} />;
        if (part.type === "image") {
          return (
            <ImageBlock
              key={"image-" + index}
              src={part.src}
              alt={part.alt}
              align={part.align}
              width={part.width}
              radius={part.radius}
              caption={part.caption}
              link={part.link}
              lightbox={part.lightbox}
            />
          );
        }
        if (part.type === "quote") return <QuoteBlock key={"quote-" + index} text={part.text} cite={part.cite} style={part.style} />;
        if (part.type === "callout") return <CalloutBlock key={"callout-" + index} title={part.title} body={part.body} cite={part.cite} tone={part.tone} />;
        if (part.type === "embed") return <EmbedBlock key={"embed-" + index} src={part.src} title={part.title} caption={part.caption} aspect={part.aspect} />;
        return <div key={"html-" + index} dangerouslySetInnerHTML={{ __html: part.html }} />;
      })}
    </div>
  );
}
