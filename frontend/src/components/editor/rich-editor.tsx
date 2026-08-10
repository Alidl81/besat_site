"use client";

import {
  Node as TiptapNode,
  mergeAttributes,
  type JSONContent,
  type NodeViewRendererProps,
} from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
import DragHandle from "@tiptap/extension-drag-handle";
import FileHandler from "@tiptap/extension-file-handler";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { EditorIcon, type EditorIconName } from "@/components/editor/editor-icons";
import {
  normalizeSafeEmbedUrl,
  safeStructuredMediaUrl,
} from "@/lib/editor/structured-content";

export type RichEditorMode = "simple" | "advanced";

export type EditorBlockType =
  | "heading"
  | "paragraph"
  | "image"
  | "gallery"
  | "quote"
  | "divider"
  | "table"
  | "code";

export type EditorOutlineItem = {
  index: number;
  type: string;
  label: string;
};

export type EditorDocumentStats = {
  blocks: number;
  characters: number;
  words: number;
  readingMinutes: number;
};

export type RichEditorHandle = {
  deleteBlock: (index: number) => void;
  duplicateBlock: (index: number) => void;
  focusBlock: (index: number) => void;
  insertBlock: (type: EditorBlockType) => void;
  insertHtml: (html: string) => void;
  moveBlock: (fromIndex: number, toIndex: number) => void;
};

export type RichEditorProps = {
  value: string;
  onChange: (html: string) => void;
  jsonValue?: JSONContent | null;
  onJsonChange?: (json: JSONContent) => void;
  mode?: RichEditorMode;
  onOutlineChange?: (outline: EditorOutlineItem[]) => void;
  onStatsChange?: (stats: EditorDocumentStats) => void;
  onUploadMedia?: (file: File) => Promise<{
    url: string;
    media_type?: "image" | "video";
    alt_text?: string;
    caption?: string;
  }>;
  onUploadState?: (uploading: boolean) => void;
  placeholder?: string;
};

type GalleryMediaItem = {
  src: string;
  type: "image" | "video";
  id?: string;
  title?: string;
  alt?: string;
  caption?: string;
  credit?: string;
};

type ToolbarButtonProps = {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
};

function safeJsonParse(value: unknown): GalleryMediaItem[] {
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value) as GalleryMediaItem[];

    if (!Array.isArray(parsed)) return [];

    const items: GalleryMediaItem[] = [];
    for (const item of parsed) {
      const src = safeStructuredMediaUrl(item?.src);
      if (!src) continue;
      items.push({
        src,
        type: item.type === "video" ? "video" : "image",
        id: typeof item.id === "string" ? item.id : undefined,
        title: typeof item.title === "string" ? item.title : undefined,
        alt: typeof item.alt === "string" ? item.alt : undefined,
        caption: typeof item.caption === "string" ? item.caption : undefined,
        credit: typeof item.credit === "string" ? item.credit : undefined,
      });
    }
    return items;
  } catch {
    return [];
  }
}

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isVideoSource(src: string | null | undefined) {
  if (!src) return false;
  const normalized = src.toLowerCase();

  return (
    normalized.startsWith("data:video/") ||
    normalized.endsWith(".mp4") ||
    normalized.endsWith(".webm") ||
    normalized.endsWith(".ogg") ||
    normalized.includes(".mp4?") ||
    normalized.includes(".webm?") ||
    normalized.includes(".ogg?")
  );
}

function parseGalleryItemsFromElement(element: HTMLElement) {
  const items: GalleryMediaItem[] = [];

  const dataItems = Array.from(element.querySelectorAll<HTMLElement>("[data-besat-gallery-item]"));

  for (const item of dataItems) {
    const src = safeStructuredMediaUrl(item.getAttribute("data-src"));
    const type = item.getAttribute("data-type") === "video" || isVideoSource(src) ? "video" : "image";

    if (src) {
      items.push({
        src: decodeHtml(src),
        type,
        id: item.getAttribute("data-id") ?? undefined,
        title: item.getAttribute("data-title") ?? undefined,
        alt: item.getAttribute("data-alt") ?? undefined,
        caption: item.getAttribute("data-caption") ?? undefined,
        credit: item.getAttribute("data-credit") ?? undefined,
      });
    }
  }

  if (items.length > 0) return items;

  const mediaItems = Array.from(element.querySelectorAll<HTMLImageElement | HTMLVideoElement>("img, video"));

  for (const item of mediaItems) {
    const src = safeStructuredMediaUrl(item.getAttribute("src"));
    const type = item.tagName.toLowerCase() === "video" || isVideoSource(src) ? "video" : "image";

    if (src) {
      items.push({
        src: decodeHtml(src),
        type,
        alt: item instanceof HTMLImageElement ? item.alt : undefined,
      });
    }
  }

  return items;
}

function setElementClass(element: HTMLElement, selected: boolean) {
  element.className = [
    "relative",
    "my-6",
    "rounded-[1.8rem]",
    "border",
    "bg-slate-50",
    "p-3",
    "transition",
    selected ? "border-blue-400" : "border-slate-200",
    selected ? "ring-4" : "",
    selected ? "ring-blue-100" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function createSvgIcon(paths: string[]) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  for (const d of paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  return svg;
}

function createIconButton(className: string, label: string, iconPaths: string[]) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.appendChild(createSvgIcon(iconPaths));
  return button;
}

const ICON_CLOSE = ["M18 6 6 18", "M6 6l12 12"];
const ICON_PREV = ["m15 18-6-6 6-6"];
const ICON_NEXT = ["m9 18 6-6-6-6"];
const ICON_PLUS = ["M12 5v14", "M5 12h14"];

const GALLERY_RESOLVE_UPLOAD_EVENT = "besat-gallery-resolve-upload";

function createGalleryNodeView({
  node,
  editor,
  getPos,
}: NodeViewRendererProps) {
  let currentNode = node;
  let selected = false;

  const dom = document.createElement("div");
  dom.contentEditable = "false";
  dom.setAttribute("data-besat-editor-block", "gallery");
  dom.style.maxWidth = "100%";
  setElementClass(dom, selected);

  const grid = document.createElement("div");
  grid.className = "grid h-full gap-3 overflow-hidden sm:grid-cols-2 lg:grid-cols-3";
  dom.appendChild(grid);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.multiple = true;
  fileInput.accept = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/ogg";
  fileInput.className = "sr-only";
  fileInput.addEventListener("change", () => {
    const files = fileInput.files ? Array.from(fileInput.files) : [];
    fileInput.value = "";
    if (files.length > 0) void addFiles(files);
  });
  dom.appendChild(fileInput);

  function updateAttributes(attrs: Record<string, string>) {
    if (typeof getPos !== "function") return;

    const position = getPos();

    if (typeof position !== "number") return;

    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(position, undefined, {
        ...currentNode.attrs,
        ...attrs,
      }),
    );
  }

  function writeItems(items: GalleryMediaItem[]) {
    updateAttributes({ items: JSON.stringify(items) });
  }

  function getUploadHandler() {
    const ref: { current?: (file: File) => Promise<GalleryUploadResult> } = {};
    dom.dispatchEvent(
      new CustomEvent(GALLERY_RESOLVE_UPLOAD_EVENT, { detail: { ref }, bubbles: true }),
    );
    return ref.current;
  }

  async function addFiles(files: File[]) {
    const upload = getUploadHandler();
    if (!upload) return;

    const items = safeJsonParse(currentNode.attrs.items);
    const next = [...items];

    for (const file of files) {
      try {
        const uploaded = await upload(file);
        next.push({
          src: uploaded.url,
          type: uploaded.media_type === "video" || file.type.startsWith("video/") ? "video" : "image",
          id: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          title: file.name,
          alt: uploaded.alt_text ?? file.name,
          caption: uploaded.caption ?? "",
        });
      } catch {
        // A single failed upload shouldn't drop the others already added.
      }
    }

    writeItems(next);
  }

  function removeItem(index: number) {
    const items = safeJsonParse(currentNode.attrs.items);
    writeItems(items.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const items = safeJsonParse(currentNode.attrs.items);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    writeItems(next);
  }

  function updateItemField(index: number, field: "alt" | "caption", value: string) {
    const items = safeJsonParse(currentNode.attrs.items);
    if (!items[index]) return;

    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    writeItems(next);
  }

  function createAddTile(compact: boolean) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = compact
      ? "besat-gallery-add-tile besat-gallery-add-tile--compact"
      : "besat-gallery-add-tile";
    tile.setAttribute("aria-label", "افزودن تصویر یا ویدیو به گالری");
    tile.appendChild(createSvgIcon(ICON_PLUS));
    const label = document.createElement("span");
    label.textContent = "افزودن رسانه";
    tile.appendChild(label);
    tile.addEventListener("click", () => fileInput.click());
    return tile;
  }

  function render() {
    const items = safeJsonParse(currentNode.attrs.items);
    const width = typeof currentNode.attrs.width === "string" ? currentNode.attrs.width : "100%";
    const height = typeof currentNode.attrs.height === "string" ? currentNode.attrs.height : "14rem";

    const isScrollable = items.length > 3;

    dom.style.width = width;
    grid.className = isScrollable
      ? "flex h-full gap-3 overflow-x-auto overflow-y-hidden pb-3"
      : "grid h-full gap-3 overflow-hidden sm:grid-cols-2 lg:grid-cols-3";
    grid.innerHTML = "";

    // The add-media tile's click handler re-checks the upload handler at
    // click time rather than gating its render here, since the handler is
    // synced into editor.storage by a React effect that can run after this
    // node view's first render — gating on render would make the button
    // (dis)appear inconsistently for content that already had a gallery
    // block when the editor mounted.
    if (items.length === 0) {
      grid.appendChild(createAddTile(false));
      return;
    }

    items.forEach((item, index) => {
      const frame = document.createElement("div");
      frame.className = "besat-gallery-item overflow-hidden rounded-[1.3rem] border border-slate-200 bg-white";

      if (isScrollable) {
        frame.style.width = "clamp(9rem, 31%, 18rem)";
        frame.style.flex = "0 0 clamp(9rem, 31%, 18rem)";
      }

      const media = document.createElement("div");
      media.className = "besat-gallery-item-media";

      if (item.type === "video") {
        const video = document.createElement("video");
        video.src = item.src;
        video.muted = true;
        video.className = "w-full bg-slate-950 object-cover";
        video.style.height = height;
        media.appendChild(video);
      } else {
        const image = document.createElement("img");
        image.src = item.src;
        image.alt = item.alt ?? "";
        image.className = "w-full bg-slate-100 object-cover";
        image.style.height = height;
        media.appendChild(image);
      }

      const toolbar = document.createElement("div");
      toolbar.className = "besat-gallery-item-toolbar";

      const prevButton = createIconButton("besat-gallery-item-button", "جابجایی به عقب", ICON_PREV);
      prevButton.disabled = index === 0;
      prevButton.addEventListener("click", () => moveItem(index, -1));

      const nextButton = createIconButton("besat-gallery-item-button", "جابجایی به جلو", ICON_NEXT);
      nextButton.disabled = index === items.length - 1;
      nextButton.addEventListener("click", () => moveItem(index, 1));

      const removeButton = createIconButton("besat-gallery-item-button is-danger", "حذف از گالری", ICON_CLOSE);
      removeButton.addEventListener("click", () => removeItem(index));

      toolbar.append(prevButton, nextButton, removeButton);
      media.appendChild(toolbar);
      frame.appendChild(media);

      const fields = document.createElement("div");
      fields.className = "besat-gallery-item-fields";

      const altInput = document.createElement("input");
      altInput.type = "text";
      altInput.placeholder = "متن جایگزین (alt)";
      altInput.value = item.alt ?? "";
      altInput.className = "besat-gallery-item-input";
      altInput.setAttribute("aria-label", `متن جایگزین تصویر ${index + 1}`);
      altInput.addEventListener("change", () => updateItemField(index, "alt", altInput.value));

      const captionInput = document.createElement("input");
      captionInput.type = "text";
      captionInput.placeholder = "کپشن";
      captionInput.value = item.caption ?? "";
      captionInput.className = "besat-gallery-item-input";
      captionInput.setAttribute("aria-label", `کپشن تصویر ${index + 1}`);
      captionInput.addEventListener("change", () => updateItemField(index, "caption", captionInput.value));

      fields.append(altInput, captionInput);
      frame.appendChild(fields);

      grid.appendChild(frame);
    });

    grid.appendChild(createAddTile(isScrollable));
  }

  function startResize(corner: "top-right" | "top-left" | "bottom-right" | "bottom-left", event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const rect = dom.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = rect.width;
    const startHeight = rect.height;

    function handleMove(moveEvent: MouseEvent) {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const horizontalFactor = corner.includes("left") ? -1 : 1;
      const verticalFactor = corner.includes("top") ? -1 : 1;

      const nextWidth = Math.max(260, Math.min(1100, startWidth + dx * horizontalFactor));
      const nextHeight = Math.max(180, Math.min(720, startHeight + dy * verticalFactor));

      updateAttributes({
        width: `${Math.round(nextWidth)}px`,
        height: `${Math.round(nextHeight)}px`,
      });
    }

    function handleUp() {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  const handles: { corner: "top-right" | "top-left" | "bottom-right" | "bottom-left"; className: string }[] = [
    {
      corner: "top-right",
      className: "absolute right-[-0.45rem] top-[-0.45rem] size-4 rounded-md border border-blue-500 bg-white shadow",
    },
    {
      corner: "top-left",
      className: "absolute left-[-0.45rem] top-[-0.45rem] size-4 rounded-md border border-blue-500 bg-white shadow",
    },
    {
      corner: "bottom-right",
      className: "absolute bottom-[-0.45rem] right-[-0.45rem] size-4 rounded-md border border-blue-500 bg-white shadow",
    },
    {
      corner: "bottom-left",
      className: "absolute bottom-[-0.45rem] left-[-0.45rem] size-4 rounded-md border border-blue-500 bg-white shadow",
    },
  ];

  for (const handle of handles) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", "تغییر اندازه گالری");
    button.className = handle.className;
    button.addEventListener("mousedown", (event) => startResize(handle.corner, event));
    dom.appendChild(button);
  }

  render();

  return {
    dom,
    update(updatedNode: ProseMirrorNode) {
      if (updatedNode.type.name !== currentNode.type.name) return false;

      currentNode = updatedNode;
      render();

      return true;
    },
    selectNode() {
      selected = true;
      setElementClass(dom, selected);
    },
    deselectNode() {
      selected = false;
      setElementClass(dom, selected);
    },
  };
}

type GalleryUploadResult = {
  url: string;
  media_type?: "image" | "video";
  alt_text?: string;
  caption?: string;
};

const BesatGalleryBlock = TiptapNode.create({
  name: "besatGalleryBlock",

  priority: 1000,

  group: "block",

  atom: true,

  selectable: true,

  draggable: true,

  addAttributes() {
    return {
      items: {
        default: "[]",
        parseHTML: (element) => {
          const htmlElement = element as HTMLElement;
          const dataItems = htmlElement.getAttribute("data-items");

          if (dataItems) return dataItems;

          return JSON.stringify(parseGalleryItemsFromElement(htmlElement));
        },
        renderHTML: () => ({}),
      },
      width: {
        default: "100%",
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-width") ?? "100%",
        renderHTML: (attributes) => ({
          "data-width": attributes.width,
        }),
      },
      height: {
        default: "14rem",
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-height") ?? "14rem",
        renderHTML: (attributes) => ({
          "data-height": attributes.height,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'section[data-besat-block="gallery"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const items = safeJsonParse(node.attrs.items);

    const children = items.map((item) => [
      "div",
      {
        "data-besat-gallery-item": "",
        "data-type": item.type,
        "data-src": item.src,
        ...(item.id ? { "data-id": item.id } : {}),
        ...(item.title ? { "data-title": item.title } : {}),
        ...(item.alt ? { "data-alt": item.alt } : {}),
        ...(item.caption ? { "data-caption": item.caption } : {}),
        ...(item.credit ? { "data-credit": item.credit } : {}),
      },
    ]);

    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-besat-block": "gallery",
        class: "my-8",
      }),
      ...children,
    ];
  },

  addNodeView() {
    return (props) => createGalleryNodeView(props);
  },
});

function readStructuredText(element: HTMLElement, attribute: string, selector: string) {
  return (
    element.getAttribute(attribute)
    ?? element.querySelector(selector)?.textContent?.trim()
    ?? ""
  );
}

function readStructuredMediaSource(element: HTMLElement) {
  return safeStructuredMediaUrl(
    element.getAttribute("data-src")
    ?? element.querySelector("img, video")?.getAttribute("src"),
  ) ?? "";
}

const BesatMediaBlock = TiptapNode.create({
  name: "besatMediaBlock",
  priority: 1000,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (element) => readStructuredMediaSource(element as HTMLElement),
        renderHTML: () => ({}),
      },
      mediaType: {
        default: "image",
        parseHTML: (element) => {
          const htmlElement = element as HTMLElement;
          return htmlElement.getAttribute("data-media-type") === "video"
            || htmlElement.querySelector("video")
            ? "video"
            : "image";
        },
        renderHTML: () => ({}),
      },
      id: {
        default: "",
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-id") ?? "",
        renderHTML: () => ({}),
      },
      title: {
        default: "",
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-title") ?? "",
        renderHTML: () => ({}),
      },
      alt: {
        default: "",
        parseHTML: (element) => {
          const htmlElement = element as HTMLElement;
          return htmlElement.getAttribute("data-alt")
            ?? htmlElement.querySelector("img")?.getAttribute("alt")
            ?? "";
        },
        renderHTML: () => ({}),
      },
      caption: {
        default: "",
        parseHTML: (element) => readStructuredText(element as HTMLElement, "data-caption", "figcaption"),
        renderHTML: () => ({}),
      },
      credit: {
        default: "",
        parseHTML: (element) => readStructuredText(element as HTMLElement, "data-credit", "cite"),
        renderHTML: () => ({}),
      },
      width: {
        default: "",
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-width") ?? "",
        renderHTML: () => ({}),
      },
      height: {
        default: "",
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-height") ?? "",
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-besat-block="media"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs;
    const src = safeStructuredMediaUrl(attrs.src) ?? "";
    const media =
      attrs.mediaType === "video"
        ? ["video", { src, controls: "controls", preload: "metadata" }]
        : ["img", { src, alt: attrs.alt || attrs.title || "" }];
    const children = [
      media,
      ...(attrs.caption ? [["figcaption", {}, attrs.caption]] : []),
      ...(attrs.credit ? [["cite", {}, attrs.credit]] : []),
    ];
    return [
      "figure",
      mergeAttributes(HTMLAttributes, {
        "data-besat-block": "media",
        "data-src": src,
        "data-media-type": attrs.mediaType === "video" ? "video" : "image",
        ...(attrs.id ? { "data-id": attrs.id } : {}),
        ...(attrs.title ? { "data-title": attrs.title } : {}),
        ...(attrs.alt ? { "data-alt": attrs.alt } : {}),
        ...(attrs.caption ? { "data-caption": attrs.caption } : {}),
        ...(attrs.credit ? { "data-credit": attrs.credit } : {}),
        ...(attrs.width ? { "data-width": attrs.width } : {}),
        ...(attrs.height ? { "data-height": attrs.height } : {}),
      }),
      ...children,
    ];
  },
});

const BesatQuoteBlock = TiptapNode.create({
  name: "besatQuoteBlock",
  priority: 1000,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      text: {
        default: "",
        parseHTML: (element) => readStructuredText(element as HTMLElement, "data-text", "p"),
        renderHTML: () => ({}),
      },
      cite: {
        default: "",
        parseHTML: (element) => readStructuredText(element as HTMLElement, "data-cite", "cite"),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'blockquote[data-besat-block="quote"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const text = String(node.attrs.text ?? "");
    const cite = String(node.attrs.cite ?? "");
    return [
      "blockquote",
      mergeAttributes(HTMLAttributes, {
        "data-besat-block": "quote",
        "data-text": text,
        ...(cite ? { "data-cite": cite } : {}),
      }),
      ["p", {}, text],
      ...(cite ? [["cite", {}, cite]] : []),
    ];
  },
});

const BesatCalloutBlock = TiptapNode.create({
  name: "besatCalloutBlock",
  priority: 1000,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      title: {
        default: "",
        parseHTML: (element) => readStructuredText(element as HTMLElement, "data-title", "h1, h2, h3, h4, h5, h6"),
        renderHTML: () => ({}),
      },
      body: {
        default: "",
        parseHTML: (element) => readStructuredText(element as HTMLElement, "data-body", "p"),
        renderHTML: () => ({}),
      },
      cite: {
        default: "",
        parseHTML: (element) => readStructuredText(element as HTMLElement, "data-cite", "cite"),
        renderHTML: () => ({}),
      },
      tone: {
        default: "info",
        parseHTML: (element) => {
          const tone = (element as HTMLElement).getAttribute("data-tone");
          return tone === "warning" || tone === "success" ? tone : "info";
        },
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-besat-block="callout"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs;
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-besat-block": "callout",
        "data-tone": attrs.tone === "warning" || attrs.tone === "success" ? attrs.tone : "info",
        ...(attrs.title ? { "data-title": attrs.title } : {}),
        "data-body": attrs.body ?? "",
        ...(attrs.cite ? { "data-cite": attrs.cite } : {}),
      }),
      ...(attrs.title ? [["h3", {}, attrs.title]] : []),
      ["p", {}, attrs.body ?? ""],
      ...(attrs.cite ? [["cite", {}, attrs.cite]] : []),
    ];
  },
});

const BesatEmbedBlock = TiptapNode.create({
  name: "besatEmbedBlock",
  priority: 1000,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (element) => {
          const htmlElement = element as HTMLElement;
          return normalizeSafeEmbedUrl(
            htmlElement.getAttribute("data-src")
            ?? htmlElement.querySelector("iframe")?.getAttribute("src"),
          ) ?? "";
        },
        renderHTML: () => ({}),
      },
      title: {
        default: "",
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-title")
          ?? (element as HTMLElement).querySelector("iframe")?.getAttribute("title")
          ?? "",
        renderHTML: () => ({}),
      },
      caption: {
        default: "",
        parseHTML: (element) => readStructuredText(element as HTMLElement, "data-caption", "figcaption"),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-besat-block="embed"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const src = normalizeSafeEmbedUrl(node.attrs.src) ?? "";
    const title = String(node.attrs.title || "ویدئوی درج‌شده");
    const caption = String(node.attrs.caption ?? "");
    return [
      "figure",
      mergeAttributes(HTMLAttributes, {
        "data-besat-block": "embed",
        "data-src": src,
        "data-title": title,
        ...(caption ? { "data-caption": caption } : {}),
      }),
      [
        "iframe",
        {
          src,
          title,
          loading: "lazy",
          referrerpolicy: "strict-origin-when-cross-origin",
          allowfullscreen: "true",
        },
      ],
      ...(caption ? [["figcaption", {}, caption]] : []),
    ];
  },
});

export function createRichEditorDocumentExtensions(mode: RichEditorMode) {
  return [
    StarterKit.configure({
      link: false,
      underline: false,
    }),
    BesatGalleryBlock,
    BesatMediaBlock,
    BesatQuoteBlock,
    BesatCalloutBlock,
    BesatEmbedBlock,
    Underline,
    Link.configure({ openOnClick: false, autolink: true, defaultProtocol: "https" }),
    Image.configure({ inline: false, allowBase64: false }),
    TableKit.configure({ table: { resizable: mode === "advanced" } }),
    TextAlign.configure({
      types: ["heading", "paragraph", "tableCell", "tableHeader"],
    }),
  ];
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`besat-editor-tool ${active ? "is-active" : ""}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden="true" className="besat-editor-toolbar-divider" />;
}

function ToolbarIcon({ name }: { name: EditorIconName }) {
  return <EditorIcon name={name} className="size-[1.05rem]" />;
}

function Toolbar({
  editor,
  mode,
  onChooseImage,
}: {
  editor: Editor;
  mode: RichEditorMode;
  onChooseImage: () => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      h1: current.isActive("heading", { level: 1 }),
      h2: current.isActive("heading", { level: 2 }),
      h3: current.isActive("heading", { level: 3 }),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      blockquote: current.isActive("blockquote"),
      codeBlock: current.isActive("codeBlock"),
      link: current.isActive("link"),
      alignRight: current.isActive({ textAlign: "right" }),
      alignCenter: current.isActive({ textAlign: "center" }),
      alignLeft: current.isActive({ textAlign: "left" }),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  function openLinkEditor() {
    setLinkValue((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkOpen(true);
  }

  function applyLink() {
    const href = linkValue.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setLinkOpen(false);
  }

  return (
    <div className="besat-editor-toolbar">
      <div className="besat-editor-toolbar-scroll">
        <ToolbarButton title="درشت" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}><ToolbarIcon name="bold" /></ToolbarButton>
        <ToolbarButton title="مورب" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><ToolbarIcon name="italic" /></ToolbarButton>
        <ToolbarButton title="زیرخط" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><ToolbarIcon name="underline" /></ToolbarButton>
        <ToolbarButton title="خط‌خورده" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><ToolbarIcon name="strike" /></ToolbarButton>
        <Divider />
        <ToolbarButton title="عنوان اصلی" active={state.h1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><span className="text-[11px] font-black">H1</span></ToolbarButton>
        <ToolbarButton title="عنوان بخش" active={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><span className="text-[11px] font-black">H2</span></ToolbarButton>
        <ToolbarButton title="عنوان فرعی" active={state.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><span className="text-[11px] font-black">H3</span></ToolbarButton>
        <Divider />
        <ToolbarButton title="فهرست نقطه‌ای" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}><ToolbarIcon name="bullet-list" /></ToolbarButton>
        <ToolbarButton title="فهرست شماره‌دار" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ToolbarIcon name="ordered-list" /></ToolbarButton>
        <ToolbarButton title="نقل‌قول" active={state.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}><ToolbarIcon name="quote" /></ToolbarButton>
        {mode === "advanced" ? <ToolbarButton title="بلوک کد" active={state.codeBlock} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><ToolbarIcon name="code" /></ToolbarButton> : null}
        <Divider />
        <ToolbarButton title="راست‌چین" active={state.alignRight} onClick={() => editor.chain().focus().setTextAlign("right").run()}><ToolbarIcon name="align-right" /></ToolbarButton>
        <ToolbarButton title="وسط‌چین" active={state.alignCenter} onClick={() => editor.chain().focus().setTextAlign("center").run()}><ToolbarIcon name="align-center" /></ToolbarButton>
        <ToolbarButton title="چپ‌چین" active={state.alignLeft} onClick={() => editor.chain().focus().setTextAlign("left").run()}><ToolbarIcon name="align-left" /></ToolbarButton>
        <Divider />
        <ToolbarButton title="افزودن یا ویرایش لینک" active={state.link} onClick={openLinkEditor}><ToolbarIcon name="link" /></ToolbarButton>
        <ToolbarButton title="بارگذاری تصویر" onClick={onChooseImage}><ToolbarIcon name="image" /></ToolbarButton>
        {mode === "advanced" ? (
          <>
            <ToolbarButton title="درج جدول" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><ToolbarIcon name="table" /></ToolbarButton>
            <ToolbarButton title="خط جداکننده" onClick={() => editor.chain().focus().setHorizontalRule().run()}><ToolbarIcon name="divider" /></ToolbarButton>
          </>
        ) : null}
        <Divider />
        <ToolbarButton title="واگرد" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}><ToolbarIcon name="undo" /></ToolbarButton>
        <ToolbarButton title="ازنو" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}><ToolbarIcon name="redo" /></ToolbarButton>
      </div>

      {linkOpen ? (
        <div className="besat-editor-link-popover" role="dialog" aria-label="تنظیم لینک">
          <label htmlFor="besat-editor-link" className="sr-only">نشانی لینک</label>
          <input
            id="besat-editor-link"
            dir="ltr"
            autoFocus
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              }
              if (event.key === "Escape") setLinkOpen(false);
            }}
            placeholder="https://example.com"
          />
          <button type="button" onClick={applyLink} aria-label="اعمال لینک"><EditorIcon name="check" /></button>
          <button type="button" onClick={() => setLinkOpen(false)} aria-label="بستن تنظیم لینک"><EditorIcon name="close" /></button>
        </div>
      ) : null}
    </div>
  );
}

function textFromNode(node: JSONContent): string {
  if (typeof node.text === "string") return node.text;
  return (node.content ?? []).map(textFromNode).join(" ");
}

function outlineLabel(node: JSONContent, index: number) {
  const text = textFromNode(node).replace(/\s+/g, " ").trim();
  if (text) return text.length > 42 ? `${text.slice(0, 42)}…` : text;

  const labels: Record<string, string> = {
    besatGalleryBlock: "گالری رسانه",
    besatMediaBlock: "رسانه",
    besatQuoteBlock: "نقل‌قول",
    besatCalloutBlock: "متن برجسته",
    besatEmbedBlock: "ویدئوی تعبیه‌شده",
    blockquote: "نقل‌قول",
    bulletList: "فهرست نقطه‌ای",
    codeBlock: "بلوک کد",
    heading: "عنوان بدون متن",
    horizontalRule: "خط جداکننده",
    image: "تصویر",
    orderedList: "فهرست شماره‌دار",
    paragraph: "پاراگراف خالی",
    table: "جدول",
  };

  return labels[node.type ?? ""] ?? `بلوک ${index + 1}`;
}

function buildOutline(editor: Editor): EditorOutlineItem[] {
  return (editor.getJSON().content ?? []).map((node, index) => ({
    index,
    type: node.type ?? "unknown",
    label: outlineLabel(node, index),
  }));
}

function createDragHandleElement() {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "besat-editor-drag-handle";
  element.setAttribute("aria-label", "جابجایی بلوک");
  element.setAttribute("title", "برای جابجایی بکشید");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const [cx, cy] of [["9", "6"], ["15", "6"], ["9", "12"], ["15", "12"], ["9", "18"], ["15", "18"]]) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", cx);
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", "1.35");
    circle.setAttribute("fill", "currentColor");
    svg.appendChild(circle);
  }
  element.appendChild(svg);
  return element;
}

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(function RichEditor({
  value,
  onChange,
  jsonValue,
  onJsonChange,
  mode = "simple",
  onOutlineChange,
  onStatsChange,
  onUploadMedia,
  onUploadState,
  placeholder,
}, ref) {
  const isInternalUpdate = useRef(false);
  const imageInput = useRef<HTMLInputElement>(null);

  const emitDerivedState = useCallback((current: Editor) => {
    const words = current.storage.characterCount.words() as number;
    const characters = current.storage.characterCount.characters() as number;
    const outline = buildOutline(current);
    onOutlineChange?.(outline);
    onStatsChange?.({
      blocks: outline.length,
      characters,
      words,
      readingMinutes: Math.max(1, Math.ceil(words / 180)),
    });
  }, [onOutlineChange, onStatsChange]);

  async function uploadAndInsert(current: Editor, file: File, position?: number) {
    onUploadState?.(true);
    try {
      if (!onUploadMedia) {
        throw new Error("برای بارگذاری رسانه، اتصال سرویس رسانه الزامی است.");
      }
      const uploaded = await onUploadMedia(file);
      const mediaType =
        uploaded.media_type === "video" || file.type.startsWith("video/")
          ? "video"
          : "image";
      const mediaNode =
        mediaType === "video"
          ? {
              type: "besatMediaBlock",
              attrs: {
                src: uploaded.url,
                mediaType,
                title: file.name,
                alt: uploaded.alt_text ?? file.name,
                caption: uploaded.caption ?? "",
              },
            }
          : {
              type: "image",
              attrs: {
                src: uploaded.url,
                alt: uploaded.alt_text ?? file.name,
                title: file.name,
              },
            };
      if (typeof position === "number") {
        current.chain().focus().insertContentAt(position, mediaNode).run();
      } else {
        if (mediaType === "video") {
          current.chain().focus().insertContent(mediaNode).run();
        } else {
          current.chain().focus().setImage(mediaNode.attrs).run();
        }
      }
    } finally {
      onUploadState?.(false);
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: [
      ...createRichEditorDocumentExtensions(mode),
      CharacterCount,
      DragHandle.configure({
        render: createDragHandleElement,
        computePositionConfig: { placement: "right-start" },
        nested: { edgeDetection: "right" },
      }),
      FileHandler.configure({
        allowedMimeTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "image/avif",
          "video/mp4",
          "video/webm",
          "video/ogg",
        ],
        onDrop: (current, files, position) => {
          files.forEach((file, index) => void uploadAndInsert(current, file, position + index));
        },
        onPaste: (current, files) => {
          files.forEach((file) => void uploadAndInsert(current, file));
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "متن محتوای خود را اینجا بنویسید...",
      }),
    ],
    content: jsonValue ?? value,
    editorProps: {
      attributes: {
        dir: "rtl",
        class: `besat-rich-content besat-editor-canvas ${mode === "advanced" ? "is-advanced" : "is-simple"}`,
        "aria-label": "متن محتوا",
      },
    },
    onCreate({ editor: current }) {
      emitDerivedState(current);
    },
    onUpdate({ editor: current }) {
      isInternalUpdate.current = true;
      onChange(current.getHTML());
      onJsonChange?.(current.getJSON());
      emitDerivedState(current);
    },
  });

  // The gallery block's node view is plain DOM (TipTap node views aren't
  // React), so it can't read the current onUploadMedia prop directly. It
  // asks for it via a synchronous custom event instead of a ref, since a
  // ref read outside an effect/handler — even indirectly, e.g. passed into
  // an extension's .configure() during render — trips the
  // react-hooks/refs rule. The listener re-attaches whenever onUploadMedia
  // changes, so it never reads a stale closure.
  useEffect(() => {
    const container = editor?.view.dom;
    if (!container) return;

    function handleResolveUploadMedia(event: Event) {
      const detail = (event as CustomEvent<{ ref: { current?: typeof onUploadMedia } }>).detail;
      detail.ref.current = onUploadMedia;
    }

    container.addEventListener(GALLERY_RESOLVE_UPLOAD_EVENT, handleResolveUploadMedia);
    return () => container.removeEventListener(GALLERY_RESOLVE_UPLOAD_EVENT, handleResolveUploadMedia);
  }, [editor, onUploadMedia]);

  useImperativeHandle(ref, () => ({
    insertBlock(type) {
      if (!editor) return;
      if (type === "image") {
        imageInput.current?.click();
        return;
      }
      if (type === "table") {
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        return;
      }
      if (type === "divider") {
        editor.chain().focus().setHorizontalRule().run();
        return;
      }
      if (type === "code") {
        editor.chain().focus().setCodeBlock().insertContent("کد را اینجا وارد کنید").run();
        return;
      }
      if (type === "gallery") {
        editor.chain().focus().insertContent({ type: "besatGalleryBlock", attrs: { items: "[]" } }).run();
        return;
      }
      const content: JSONContent =
        type === "heading"
          ? { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "عنوان بخش" }] }
          : type === "quote"
            ? { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "متن نقل‌قول" }] }] }
            : { type: "paragraph", content: [{ type: "text", text: "متن جدید" }] };
      editor.chain().focus().insertContent(content).run();
    },
    insertHtml(html) {
      editor?.chain().focus().insertContent(html).run();
    },
    moveBlock(fromIndex, toIndex) {
      if (!editor || fromIndex === toIndex) return;
      const json = editor.getJSON();
      const blocks = [...(json.content ?? [])];
      if (!blocks[fromIndex] || toIndex < 0 || toIndex >= blocks.length) return;
      const [moved] = blocks.splice(fromIndex, 1);
      blocks.splice(toIndex, 0, moved);
      editor.commands.setContent({ ...json, content: blocks }, { emitUpdate: true });
    },
    duplicateBlock(index) {
      if (!editor) return;
      const json = editor.getJSON();
      const blocks = [...(json.content ?? [])];
      if (!blocks[index]) return;
      blocks.splice(
        index + 1,
        0,
        JSON.parse(JSON.stringify(blocks[index])) as (typeof blocks)[number],
      );
      editor.commands.setContent({ ...json, content: blocks }, { emitUpdate: true });
    },
    deleteBlock(index) {
      if (!editor) return;
      const json = editor.getJSON();
      const blocks = [...(json.content ?? [])];
      if (!blocks[index]) return;
      blocks.splice(index, 1);
      editor.commands.setContent({ ...json, content: blocks.length ? blocks : [{ type: "paragraph" }] }, { emitUpdate: true });
    },
    focusBlock(index) {
      if (!editor || index < 0 || index >= editor.state.doc.childCount) return;
      let position = 0;
      for (let current = 0; current < index; current += 1) position += editor.state.doc.child(current).nodeSize;
      const node = editor.state.doc.child(index);
      if (node.isAtom) {
        editor.chain().focus().setNodeSelection(position).scrollIntoView().run();
      } else {
        editor.chain().focus().setTextSelection(Math.min(position + 1, editor.state.doc.content.size)).scrollIntoView().run();
      }
    },
  }), [editor]);

  useEffect(() => {
    if (!editor) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (jsonValue) {
      if (JSON.stringify(jsonValue) !== JSON.stringify(editor.getJSON())) {
        editor.commands.setContent(jsonValue, { emitUpdate: false });
        emitDerivedState(editor);
      }
    } else if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
      emitDerivedState(editor);
    }
  }, [value, jsonValue, editor, emitDerivedState]);

  if (!editor) {
    return <div className="min-h-[28rem] animate-pulse rounded-xl border border-slate-200 bg-slate-50" aria-label="در حال آماده‌سازی ویرایشگر" />;
  }

  return (
    <div className={`besat-editor-frame ${mode === "advanced" ? "is-advanced" : "is-simple"}`}>
      <input
        ref={imageInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/ogg"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadAndInsert(editor, file);
          event.currentTarget.value = "";
        }}
      />
      <Toolbar editor={editor} mode={mode} onChooseImage={() => imageInput.current?.click()} />
      <EditorContent editor={editor} />
    </div>
  );
});
