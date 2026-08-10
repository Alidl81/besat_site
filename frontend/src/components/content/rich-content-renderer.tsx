"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { PanelIcon } from "@/components/dashboard/panel-icons";
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

type ContentPart =
  | { type: "html"; html: string }
  | { type: "gallery"; items: MediaItem[]; width: string; height: string }
  | { type: "media"; item: MediaItem; width: string; height: string }
  | { type: "quote"; text: string; cite: string }
  | { type: "callout"; title: string; body: string; cite: string; tone: "info" | "warning" | "success" }
  | { type: "embed"; src: string; title: string; caption: string };

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

  if (block === "quote") {
    const text = getAttr(blockHtml, "data-text") || getTagText(blockHtml, "p");
    return text
      ? {
          type: "quote",
          text,
          cite: getAttr(blockHtml, "data-cite") || getTagText(blockHtml, "cite"),
        }
      : null;
  }

  if (block === "callout") {
    const tone = getAttr(blockHtml, "data-tone");
    return {
      type: "callout",
      title: getAttr(blockHtml, "data-title") || getTagText(blockHtml, "h3"),
      body: getAttr(blockHtml, "data-body") || getTagText(blockHtml, "p"),
      cite: getAttr(blockHtml, "data-cite") || getTagText(blockHtml, "cite"),
      tone: tone === "warning" || tone === "success" ? tone : "info",
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
        }
      : null;
  }

  return null;
}

function parseContent(html: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const pattern = /<(section|figure|blockquote)\b[^>]*data-besat-block=["'](?:gallery|media|quote|callout|embed)["'][\s\S]*?<\/\1>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const before = html.slice(lastIndex, match.index);
    if (before.trim()) parts.push({ type: "html", html: before });
    const part = parseBlock(match[0]);
    if (part) parts.push(part);
    lastIndex = match.index + match[0].length;
  }
  const after = html.slice(lastIndex);
  if (after.trim()) parts.push({ type: "html", html: after });
  return parts.length || !html.trim() ? parts : [{ type: "html", html }];
}

function GalleryBlock({
  items,
  width,
  height,
}: {
  items: MediaItem[];
  width: string;
  height: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const safeActiveIndex = activeIndex ?? 0;
  const activeItem = activeIndex === null ? null : items[safeActiveIndex];
  const scrollable = items.length > 3;

  useEffect(() => {
    if (activeIndex === null) return;
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setActiveIndex(null);
      } else if (event.key === "ArrowRight" && items.length > 1) {
        event.preventDefault();
        setActiveIndex((current) => current === null ? 0 : (current + 1) % items.length);
      } else if (event.key === "ArrowLeft" && items.length > 1) {
        event.preventDefault();
        setActiveIndex((current) => current === null ? 0 : (current - 1 + items.length) % items.length);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeIndex, items.length]);

  return (
    <>
      <div data-besat-rendered-block="gallery" className={scrollable ? "my-8 flex gap-4 overflow-x-auto pb-3" : "my-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"} style={{ width, maxWidth: "100%" }}>
        {items.map((item, index) => <button key={item.src + "-" + index} type="button" onClick={() => setActiveIndex(index)} className="group overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white p-2 text-right shadow-sm transition hover:-translate-y-1 hover:border-blue-300" style={scrollable ? { width: "clamp(9rem, 31%, 18rem)", flex: "0 0 clamp(9rem, 31%, 18rem)" } : undefined} aria-label={item.alt || item.title || "مشاهده رسانه"}>{item.type === "video" ? <video src={item.src} muted className="w-full rounded-[1.25rem] bg-slate-950 object-cover" style={{ height }} /> : <img src={item.src} alt={item.alt ?? ""} className="w-full rounded-[1.25rem] bg-slate-100 object-cover" style={{ height }} />}{item.caption ? <span className="mt-2 block text-xs font-bold leading-6 text-slate-600">{item.caption}</span> : null}</button>)}
      </div>
      {activeItem ? <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveIndex(null); }}><div role="dialog" aria-modal="true" aria-label={activeItem.title || activeItem.alt || "نمایش رسانه"} className="relative flex max-h-[90vh] w-full max-w-6xl flex-col items-center justify-center"><button ref={closeRef} type="button" onClick={() => setActiveIndex(null)} aria-label="بستن" className="absolute right-0 top-0 z-20 flex size-11 items-center justify-center rounded-2xl bg-white/10 text-white transition hover:bg-white/20"><PanelIcon name="close" className="size-5" /></button>{items.length > 1 ? <button type="button" onClick={() => setActiveIndex((safeActiveIndex + 1) % items.length)} className="absolute right-0 top-1/2 z-20 hidden -translate-y-1/2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/20 sm:block">بعدی</button> : null}<div className="w-full px-16">{activeItem.type === "video" ? <video src={activeItem.src} controls autoPlay className="max-h-[76vh] w-full rounded-[1.5rem] bg-black object-contain" /> : <img src={activeItem.src} alt={activeItem.alt ?? ""} className="max-h-[76vh] w-full rounded-[1.5rem] object-contain" />}{activeItem.caption || activeItem.credit ? <p className="mx-auto mt-3 max-w-3xl text-center text-sm font-bold leading-7 text-white">{activeItem.caption}{activeItem.credit ? <cite className="mr-2 not-italic text-slate-300">— {activeItem.credit}</cite> : null}</p> : null}</div>{items.length > 1 ? <button type="button" onClick={() => setActiveIndex((safeActiveIndex - 1 + items.length) % items.length)} className="absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/20 sm:block">قبلی</button> : null}</div></div> : null}
    </>
  );
}

function MediaBlock({ item, width, height }: { item: MediaItem; width: string; height: string }) {
  return <figure className="my-8 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm" style={{ width, maxWidth: "100%" }}>{item.type === "video" ? <video src={item.src} controls preload="metadata" className="w-full rounded-[1.1rem] bg-slate-950 object-contain" style={{ height: height === "auto" ? undefined : height }} /> : <img src={item.src} alt={item.alt ?? ""} className="w-full rounded-[1.1rem] object-cover" style={{ height: height === "auto" ? undefined : height }} />}{item.caption ? <figcaption className="px-2 pt-3 text-sm font-bold leading-7 text-slate-600">{item.caption}</figcaption> : null}{item.credit ? <cite className="block px-2 pt-1 text-xs font-bold not-italic text-slate-400">{item.credit}</cite> : null}</figure>;
}

function QuoteBlock({ text, cite }: { text: string; cite: string }) {
  return <blockquote className="my-8 border-r-4 border-[#d98712] bg-[#fff8ec] px-6 py-5 text-lg font-black leading-9 text-[#173652]"><p>{text}</p>{cite ? <cite className="mt-3 block text-sm font-bold not-italic text-slate-500">{cite}</cite> : null}</blockquote>;
}

function CalloutBlock({ title, body, cite, tone }: { title: string; body: string; cite: string; tone: "info" | "warning" | "success" }) {
  const toneClasses = {
    info: "border-blue-200 bg-blue-50 text-[#173652]",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  };
  return <section className={"my-8 rounded-[1.25rem] border p-5 " + toneClasses[tone]}>{title ? <h3 className="text-base font-black">{title}</h3> : null}<p className={title ? "mt-2 text-sm font-bold leading-8" : "text-sm font-bold leading-8"}>{body}</p>{cite ? <cite className="mt-2 block text-xs font-bold not-italic opacity-70">{cite}</cite> : null}</section>;
}

function EmbedBlock({ src, title, caption }: { src: string; title: string; caption: string }) {
  return <figure className="my-8 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-950 p-2 shadow-sm"><div className="aspect-video overflow-hidden rounded-[1.1rem]"><iframe src={src} title={title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen className="size-full border-0" /></div>{caption ? <figcaption className="bg-white px-3 py-3 text-sm font-bold leading-7 text-slate-600">{caption}</figcaption> : null}</figure>;
}

export function RichContentRenderer({ html }: { html: string }) {
  const parts = useMemo(() => parseContent(sanitizeCmsHtml(html)), [html]);
  return <div className="besat-rich-content mt-8 max-w-none text-right text-base font-medium leading-9 text-slate-700">{parts.map((part, index) => {
    if (part.type === "gallery") return <GalleryBlock key={"gallery-" + index} items={part.items} width={part.width} height={part.height} />;
    if (part.type === "media") return <MediaBlock key={"media-" + index} item={part.item} width={part.width} height={part.height} />;
    if (part.type === "quote") return <QuoteBlock key={"quote-" + index} text={part.text} cite={part.cite} />;
    if (part.type === "callout") return <CalloutBlock key={"callout-" + index} title={part.title} body={part.body} cite={part.cite} tone={part.tone} />;
    if (part.type === "embed") return <EmbedBlock key={"embed-" + index} src={part.src} title={part.title} caption={part.caption} />;
    return <div key={"html-" + index} dangerouslySetInnerHTML={{ __html: part.html }} />;
  })}</div>;
}
