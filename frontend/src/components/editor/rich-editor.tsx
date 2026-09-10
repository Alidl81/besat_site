"use client";

import {
  Node as TiptapNode,
  mergeAttributes,
  type JSONContent,
  type NodeViewRendererProps,
} from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
import DragHandle from "@tiptap/extension-drag-handle";
import FileHandler from "@tiptap/extension-file-handler";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import CodeBlock from "@tiptap/extension-code-block";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { EditorIcon, type EditorIconName } from "@/components/editor/editor-icons";
import {
  normalizeSafeEmbedUrl,
  safeStructuredMediaUrl,
} from "@/lib/editor/structured-content";
import { sanitizeStoredTiptapDocument } from "@/lib/editor/sanitize-table-colwidth";

export type RichEditorMode = "simple" | "advanced";

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
  insertHtml: (html: string) => void;
  moveBlock: (fromIndex: number, toIndex: number) => void;
  replaceImage: () => void;
};

// The type the selected "complex" block currently under the cursor/selection
// maps to -- drives which Inspector the side panel shows. Plain text nodes
// (paragraph/heading/list/blockquote) never produce a context, so selecting
// them returns the side panel to the ordinary Add Block palette.
// FE-CMS-SIDEBAR-ORDINARY-001: "codeBlock" deliberately excluded -- Code is
// toolbar-only per the CMS editor's UX contract and must never trigger the
// automatic sidebar inspector the other block kinds here get.
export type ActiveBlockKind =
  | "table"
  | "image"
  | "gallery"
  | "media"
  | "quote"
  | "callout"
  | "embed";

export type TableCommands = {
  addRowBefore: () => void;
  addRowAfter: () => void;
  deleteRow: () => void;
  addColumnBefore: () => void;
  addColumnAfter: () => void;
  deleteColumn: () => void;
  mergeCells: () => void;
  splitCell: () => void;
  toggleHeaderRow: () => void;
  toggleHeaderColumn: () => void;
  deleteTable: () => void;
  setCellVerticalAlign: (align: CellVerticalAlign) => void;
};

export type ActiveBlockContext = {
  kind: ActiveBlockKind;
  index: number;
  attrs: Record<string, unknown>;
  updateAttrs: (patch: Record<string, unknown>) => void;
  moveUp: () => void;
  moveDown: () => void;
  duplicate: () => void;
  remove: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  table?: TableCommands;
};

export type RichEditorProps = {
  value: string;
  onChange: (html: string) => void;
  jsonValue?: JSONContent | null;
  onJsonChange?: (json: JSONContent) => void;
  mode?: RichEditorMode;
  onOutlineChange?: (outline: EditorOutlineItem[]) => void;
  onStatsChange?: (stats: EditorDocumentStats) => void;
  onActiveBlockChange?: (block: ActiveBlockContext | null) => void;
  /**
   * Fired when the user clicks the small settings trigger that appears
   * over a selected table (see the "besat-table-settings-trigger" button
   * rendered near the end of this component). Table intentionally does
   * NOT auto-open its Inspector on selection the way the other complex
   * blocks do -- the caller decides whether to show the Table Inspector
   * only once this fires, so placing the cursor inside a table while
   * editing normal prose doesn't keep yanking the side panel away.
   */
  onTableSettingsClick?: () => void;
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

    // FE-CMS-RICH-GALLERY-NODEVIEW-UPLOAD-DOUBLE-SUBMIT-001: this used to
    // snapshot `currentNode.attrs.items` once at the start and append to
    // that local copy, then write it back after every file in *this*
    // batch finished uploading. Two same-turn addFiles() batches (e.g. two
    // separate file-input changes) both start from the same stale
    // snapshot, so whichever batch finishes last overwrites the other
    // batch's already-written items instead of merging with them. Only
    // this batch's own uploaded items are accumulated locally; the base
    // list is re-read from `currentNode` (kept current by the node view's
    // `update()` hook, so it reflects any writeItems() a concurrent batch
    // already dispatched) immediately before the final write.
    const uploadedItems: GalleryMediaItem[] = [];

    for (const file of files) {
      try {
        const uploaded = await upload(file);
        uploadedItems.push({
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

    if (uploadedItems.length === 0) return;
    // FE-CMS-EDITOR-UPLOAD-UNMOUNT-001: same guard as uploadAndInsert()/
    // the replace-image handler -- the editor (and this node view along
    // with it) can be destroyed while these uploads were in flight, and
    // updateAttributes() dispatches directly against editor.view, which
    // no longer exists once destroyed.
    if (editor.isDestroyed) return;
    const latest = safeJsonParse(currentNode.attrs.items);
    writeItems([...latest, ...uploadedItems]);
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

export const GALLERY_COLUMNS = ["2", "3", "4", "auto"] as const;
export type GalleryColumns = (typeof GALLERY_COLUMNS)[number];

export const GALLERY_GAPS = ["compact", "normal", "comfortable"] as const;
export type GalleryGap = (typeof GALLERY_GAPS)[number];

export const GALLERY_ASPECTS = ["natural", "square", "4:3", "16:9"] as const;
export type GalleryAspect = (typeof GALLERY_ASPECTS)[number];

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
      columns: {
        default: "auto" as GalleryColumns,
        parseHTML: (element) => readEnumAttr(element as HTMLElement, "data-columns", GALLERY_COLUMNS, "auto"),
        renderHTML: (attributes) => ({ "data-columns": attributes.columns ?? "auto" }),
      },
      gap: {
        default: "normal" as GalleryGap,
        parseHTML: (element) => readEnumAttr(element as HTMLElement, "data-gap", GALLERY_GAPS, "normal"),
        renderHTML: (attributes) => ({ "data-gap": attributes.gap ?? "normal" }),
      },
      aspect: {
        default: "natural" as GalleryAspect,
        parseHTML: (element) => readEnumAttr(element as HTMLElement, "data-aspect", GALLERY_ASPECTS, "natural"),
        renderHTML: (attributes) => ({ "data-aspect": attributes.aspect ?? "natural" }),
      },
      captions: {
        default: true,
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-captions") !== "false",
        renderHTML: (attributes) => ({ "data-captions": attributes.captions === false ? "false" : "true" }),
      },
      lightbox: {
        default: true,
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-lightbox") !== "false",
        renderHTML: (attributes) => ({ "data-lightbox": attributes.lightbox === false ? "false" : "true" }),
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

const IMAGE_MIN_WIDTH = 120;
const IMAGE_MAX_WIDTH = 900;
const IMAGE_RESIZE_STEP = 24;

function createResizableImageNodeView({ node, editor, getPos }: NodeViewRendererProps) {
  let currentNode = node;

  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-besat-editor-block", "image");
  wrapper.style.position = "relative";
  wrapper.style.display = "table";
  wrapper.style.maxWidth = "100%";

  const img = document.createElement("img");
  img.style.display = "block";
  img.style.maxWidth = "100%";
  img.style.height = "auto";
  wrapper.appendChild(img);

  const alignBar = document.createElement("div");
  alignBar.contentEditable = "false";
  alignBar.className = "besat-image-align-bar";
  const alignOptions: { value: "left" | "center" | "right"; label: string; paths: string[] }[] = [
    { value: "right", label: "راست‌چین", paths: ["M21 6H9M21 12H3M21 18H9"] },
    { value: "center", label: "وسط‌چین", paths: ["M21 6H3M17 12H7M21 18H3"] },
    { value: "left", label: "چپ‌چین", paths: ["M21 6H3M21 12H9M21 18H3"] },
  ];
  for (const option of alignOptions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "besat-image-align-button";
    button.setAttribute("aria-label", option.label);
    button.title = option.label;
    button.appendChild(createSvgIcon(option.paths));
    button.addEventListener("click", () => updateAttributes({ align: option.value }));
    alignBar.appendChild(button);
  }
  wrapper.appendChild(alignBar);

  function updateAttributes(attrs: Record<string, string>) {
    if (typeof getPos !== "function") return;
    const position = getPos();
    if (typeof position !== "number") return;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(position, undefined, { ...currentNode.attrs, ...attrs }),
    );
  }

  function widthPx() {
    const raw = typeof currentNode.attrs.width === "string" ? currentNode.attrs.width : "";
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : img.naturalWidth || 480;
  }

  function setWidth(next: number) {
    const clamped = Math.round(Math.min(IMAGE_MAX_WIDTH, Math.max(IMAGE_MIN_WIDTH, next)));
    updateAttributes({ width: `${clamped}px` });
  }

  function startResize(direction: 1 | -1, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = widthPx();

    function handleMove(moveEvent: MouseEvent) {
      const delta = (moveEvent.clientX - startX) * direction;
      setWidth(startWidth + delta);
    }
    function handleUp() {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  const handles: { corner: "top-right" | "top-left" | "bottom-right" | "bottom-left"; direction: 1 | -1; className: string }[] = [
    { corner: "top-right", direction: -1, className: "besat-image-resize-handle besat-image-resize-handle--top-right" },
    { corner: "top-left", direction: 1, className: "besat-image-resize-handle besat-image-resize-handle--top-left" },
    { corner: "bottom-right", direction: -1, className: "besat-image-resize-handle besat-image-resize-handle--bottom-right" },
    { corner: "bottom-left", direction: 1, className: "besat-image-resize-handle besat-image-resize-handle--bottom-left" },
  ];

  for (const handle of handles) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = handle.className;
    button.setAttribute("aria-label", "تغییر اندازه تصویر (با کلیدهای جهت‌نما هم قابل تنظیم است)");
    button.title = "برای تغییر اندازه بکشید یا از کلیدهای چپ/راست استفاده کنید";
    button.addEventListener("mousedown", (event) => startResize(handle.direction, event));
    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setWidth(widthPx() + IMAGE_RESIZE_STEP);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setWidth(widthPx() - IMAGE_RESIZE_STEP);
      }
    });
    wrapper.appendChild(button);
  }

  function render() {
    const src = safeStructuredMediaUrl(currentNode.attrs.src) ?? "";
    if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    img.alt = typeof currentNode.attrs.alt === "string" ? currentNode.attrs.alt : "";
    if (currentNode.attrs.title) img.title = String(currentNode.attrs.title);

    const width = typeof currentNode.attrs.width === "string" ? currentNode.attrs.width : "";
    img.style.width = width || "";
    wrapper.style.width = width ? width : "fit-content";

    const align = currentNode.attrs.align === "left" || currentNode.attrs.align === "right"
      ? currentNode.attrs.align
      : "center";
    wrapper.style.marginInlineStart = align === "left" ? "0" : "auto";
    wrapper.style.marginInlineEnd = align === "right" ? "0" : "auto";

    const radiusMap: Record<string, string> = { none: "0", sm: "0.4rem", md: "0.9rem", lg: "1.6rem" };
    const radius = (IMAGE_RADII as readonly string[]).includes(currentNode.attrs.radius) ? currentNode.attrs.radius : "none";
    img.style.borderRadius = radiusMap[radius];

    for (const button of Array.from(alignBar.children)) {
      const isActive = alignOptions[Array.from(alignBar.children).indexOf(button)]?.value === align;
      button.classList.toggle("is-active", isActive);
    }
  }

  render();

  return {
    dom: wrapper,
    update(updatedNode: ProseMirrorNode) {
      if (updatedNode.type.name !== currentNode.type.name) return false;
      currentNode = updatedNode;
      render();
      return true;
    },
    selectNode() {
      wrapper.classList.add("is-selected");
    },
    deselectNode() {
      wrapper.classList.remove("is-selected");
    },
  };
}

export const IMAGE_RADII = ["none", "sm", "md", "lg"] as const;
export type ImageRadius = (typeof IMAGE_RADII)[number];

const BesatResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-width")
          || (element as HTMLElement).style.width
          || null,
        renderHTML: (attributes) => (attributes.width ? { "data-width": attributes.width } : {}),
      },
      align: {
        default: "center",
        parseHTML: (element) => {
          const value = (element as HTMLElement).getAttribute("data-align");
          return value === "left" || value === "right" ? value : "center";
        },
        renderHTML: (attributes) => ({ "data-align": attributes.align ?? "center" }),
      },
      caption: {
        default: "",
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-caption") ?? "",
        renderHTML: (attributes) => (attributes.caption ? { "data-caption": attributes.caption } : {}),
      },
      link: {
        default: "",
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-link") ?? "",
        renderHTML: (attributes) => (attributes.link ? { "data-link": attributes.link } : {}),
      },
      radius: {
        default: "none" as ImageRadius,
        parseHTML: (element) => readEnumAttr(element as HTMLElement, "data-radius", IMAGE_RADII, "none"),
        renderHTML: (attributes) => {
          const radius = (IMAGE_RADII as readonly string[]).includes(attributes.radius) ? attributes.radius : "none";
          return radius === "none" ? {} : { "data-radius": radius };
        },
      },
      lightbox: {
        default: false,
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-lightbox") === "true",
        renderHTML: (attributes) => (attributes.lightbox ? { "data-lightbox": "true" } : {}),
      },
    };
  },

  addNodeView() {
    return (props) => createResizableImageNodeView(props);
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

export const QUOTE_STYLES = ["classic", "accent", "minimal"] as const;
export type QuoteStyle = (typeof QUOTE_STYLES)[number];

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
      // Legacy combined attribution field, kept for backward compatibility
      // with content saved before the author/source split.
      cite: {
        default: "",
        parseHTML: (element) => readStructuredText(element as HTMLElement, "data-cite", "cite"),
        renderHTML: () => ({}),
      },
      author: {
        default: "",
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-author") ?? "",
        renderHTML: () => ({}),
      },
      source: {
        default: "",
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-source") ?? "",
        renderHTML: () => ({}),
      },
      style: {
        default: "classic" as QuoteStyle,
        parseHTML: (element) => readEnumAttr(element as HTMLElement, "data-style", QUOTE_STYLES, "classic"),
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
    const author = String(node.attrs.author ?? "");
    const source = String(node.attrs.source ?? "");
    const style = (QUOTE_STYLES as readonly string[]).includes(node.attrs.style) ? node.attrs.style : "classic";
    const attribution = [author, source].filter(Boolean).join(" — ") || cite;
    return [
      "blockquote",
      mergeAttributes(HTMLAttributes, {
        "data-besat-block": "quote",
        "data-text": text,
        "data-style": style,
        ...(cite ? { "data-cite": cite } : {}),
        ...(author ? { "data-author": author } : {}),
        ...(source ? { "data-source": source } : {}),
      }),
      ["p", {}, text],
      ...(attribution ? [["cite", {}, attribution]] : []),
    ];
  },
});

export const CALLOUT_TONES = ["note", "info", "success", "warning", "important"] as const;
export type CalloutTone = (typeof CALLOUT_TONES)[number];

// Small monoline icon paths per tone -- no emoji, matches this file's
// existing inline-SVG icon convention (see ICON_CLOSE/ICON_PREV/ICON_NEXT
// above). The same shapes are reproduced server-side in
// backend/apps/content/rich_text.py so editor preview and published output
// show an identical icon.
export const CALLOUT_ICON_PATHS: Record<CalloutTone, string[]> = {
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

function calloutIconSpec(tone: CalloutTone) {
  return [
    "svg",
    {
      viewBox: "0 0 24 24",
      width: "20",
      height: "20",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      class: "besat-callout-icon",
    },
    ...CALLOUT_ICON_PATHS[tone].map((d) => ["path", { d }]),
  ];
}

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
        default: "info" as CalloutTone,
        parseHTML: (element) => readEnumAttr(element as HTMLElement, "data-tone", CALLOUT_TONES, "info"),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-besat-block="callout"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs;
    const tone: CalloutTone = (CALLOUT_TONES as readonly string[]).includes(attrs.tone) ? attrs.tone : "info";
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-besat-block": "callout",
        "data-tone": tone,
        ...(attrs.title ? { "data-title": attrs.title } : {}),
        "data-body": attrs.body ?? "",
        ...(attrs.cite ? { "data-cite": attrs.cite } : {}),
      }),
      calloutIconSpec(tone),
      ...(attrs.title ? [["h3", {}, attrs.title]] : []),
      ["p", {}, attrs.body ?? ""],
      ...(attrs.cite ? [["cite", {}, attrs.cite]] : []),
    ];
  },
});

export const EMBED_ASPECTS = ["16:9", "4:3", "1:1"] as const;
export type EmbedAspect = (typeof EMBED_ASPECTS)[number];

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
      aspect: {
        default: "16:9" as EmbedAspect,
        parseHTML: (element) => readEnumAttr(element as HTMLElement, "data-aspect", EMBED_ASPECTS, "16:9"),
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
    const aspect: EmbedAspect = (EMBED_ASPECTS as readonly string[]).includes(node.attrs.aspect) ? node.attrs.aspect : "16:9";
    return [
      "figure",
      mergeAttributes(HTMLAttributes, {
        "data-besat-block": "embed",
        "data-src": src,
        "data-title": title,
        "data-aspect": aspect,
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

export const TABLE_THEMES = [
  "minimal",
  "bordered",
  "striped",
  "accent-header",
  "soft",
  "compact",
  "formal",
] as const;
export type TableTheme = (typeof TABLE_THEMES)[number];

export const TABLE_DENSITIES = ["compact", "normal", "comfortable"] as const;
export type TableDensity = (typeof TABLE_DENSITIES)[number];

export const CELL_VERTICAL_ALIGNS = ["top", "middle", "bottom"] as const;
export type CellVerticalAlign = (typeof CELL_VERTICAL_ALIGNS)[number];

function readEnumAttr<T extends string>(element: HTMLElement, attribute: string, allowed: readonly T[], fallback: T): T {
  const value = element.getAttribute(attribute);
  return (allowed as readonly string[]).includes(value ?? "") ? (value as T) : fallback;
}

// Table stays TipTap's stock node (colgroup/resizable/caret logic
// untouched); only presentation attrs are added. They render purely as
// element attributes/classes -- no new DOM structure -- so the stock
// renderHTML (inherited via this.parent) keeps working unmodified. A
// <caption> preview is painted in the editor canvas via CSS
// `content: attr(data-caption)`; the backend renderer emits a real
// <caption> element for the published page.
const BesatTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      theme: {
        default: "minimal" as TableTheme,
        parseHTML: (element) => readEnumAttr(element as HTMLElement, "data-theme", TABLE_THEMES, "minimal"),
        renderHTML: (attributes) => {
          const theme = (TABLE_THEMES as readonly string[]).includes(attributes.theme) ? attributes.theme : "minimal";
          return { "data-theme": theme, class: `besat-table besat-table--theme-${theme}` };
        },
      },
      density: {
        default: "normal" as TableDensity,
        parseHTML: (element) => readEnumAttr(element as HTMLElement, "data-density", TABLE_DENSITIES, "normal"),
        renderHTML: (attributes) => {
          const density = (TABLE_DENSITIES as readonly string[]).includes(attributes.density) ? attributes.density : "normal";
          return { "data-density": density, class: `besat-table--density-${density}` };
        },
      },
      striped: {
        default: false,
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-striped") === "true",
        renderHTML: (attributes) => ({
          "data-striped": attributes.striped ? "true" : "false",
          class: attributes.striped ? "besat-table--striped" : "",
        }),
      },
      fullWidth: {
        default: true,
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-full-width") !== "false",
        renderHTML: (attributes) => ({
          "data-full-width": attributes.fullWidth === false ? "false" : "true",
          class: attributes.fullWidth === false ? "besat-table--auto-width" : "besat-table--full-width",
        }),
      },
      caption: {
        default: "",
        parseHTML: (element) => {
          const htmlElement = element as HTMLElement;
          return htmlElement.getAttribute("data-caption")
            ?? htmlElement.querySelector("caption")?.textContent?.trim()
            ?? "";
        },
        renderHTML: (attributes) => (attributes.caption ? { "data-caption": attributes.caption } : {}),
      },
    };
  },
});

const BesatTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      verticalAlign: {
        default: "top" as CellVerticalAlign,
        parseHTML: (element) => readEnumAttr(element as HTMLElement, "data-valign", CELL_VERTICAL_ALIGNS, "top"),
        renderHTML: (attributes) => {
          const align = (CELL_VERTICAL_ALIGNS as readonly string[]).includes(attributes.verticalAlign)
            ? attributes.verticalAlign
            : "top";
          return align === "top" ? {} : { "data-valign": align, class: `besat-valign-${align}` };
        },
      },
    };
  },
});

const BesatTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      verticalAlign: {
        default: "top" as CellVerticalAlign,
        parseHTML: (element) => readEnumAttr(element as HTMLElement, "data-valign", CELL_VERTICAL_ALIGNS, "top"),
        renderHTML: (attributes) => {
          const align = (CELL_VERTICAL_ALIGNS as readonly string[]).includes(attributes.verticalAlign)
            ? attributes.verticalAlign
            : "top";
          return align === "top" ? {} : { "data-valign": align, class: `besat-valign-${align}` };
        },
      },
    };
  },
});

export const CODE_LANGUAGES = [
  "plaintext",
  "javascript",
  "typescript",
  "python",
  "html",
  "css",
  "json",
  "bash",
] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

// No syntax-highlighting dependency is introduced -- the language is stored
// and shown as a label/class only. Line numbers are rendered from
// server-side line-split spans (backend rich_text.py), not client CSS
// counters, so the count stays correct after sanitization.
const BesatCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: "plaintext" as CodeLanguage,
        parseHTML: (element) => readEnumAttr(element as HTMLElement, "data-language", CODE_LANGUAGES, "plaintext"),
        renderHTML: (attributes) => {
          const language = (CODE_LANGUAGES as readonly string[]).includes(attributes.language)
            ? attributes.language
            : "plaintext";
          return { "data-language": language };
        },
      },
      lineNumbers: {
        default: false,
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-line-numbers") === "true",
        renderHTML: (attributes) => ({ "data-line-numbers": attributes.lineNumbers ? "true" : "false" }),
      },
      wrap: {
        default: false,
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-wrap") === "true",
        renderHTML: (attributes) => ({ "data-wrap": attributes.wrap ? "true" : "false" }),
      },
      copyButton: {
        default: true,
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-copy") !== "false",
        renderHTML: (attributes) => ({ "data-copy": attributes.copyButton === false ? "false" : "true" }),
      },
    };
  },
});

// Fixed swatches only -- never a free color picker. Values are validated
// against this exact list again server-side (backend/apps/content/rich_text.py)
// and in the sanitizer, so a tampered/forged request can't smuggle
// arbitrary CSS through the color/highlight marks.
export const TEXT_COLOR_SWATCHES = [
  { label: "سرمه‌ای", value: "#0a2848" },
  { label: "طلایی", value: "#c98c3d" },
  { label: "خاکستری تیره", value: "#475569" },
  { label: "قرمز", value: "#b91c1c" },
  { label: "سبز", value: "#15803d" },
] as const;

export const HIGHLIGHT_COLOR_SWATCHES = [
  { label: "طلایی ملایم", value: "#fbf3e7" },
  { label: "آبی ملایم", value: "#e8eef3" },
  { label: "زرد ملایم", value: "#fef3c7" },
  { label: "صورتی ملایم", value: "#fee2e2" },
] as const;

export function createRichEditorDocumentExtensions(mode: RichEditorMode) {
  return [
    StarterKit.configure({
      link: false,
      underline: false,
      codeBlock: false,
    }),
    BesatCodeBlock,
    BesatGalleryBlock,
    BesatMediaBlock,
    BesatQuoteBlock,
    BesatCalloutBlock,
    BesatEmbedBlock,
    Underline,
    Link.configure({ openOnClick: false, autolink: true, defaultProtocol: "https" }),
    BesatResizableImage.configure({ inline: false, allowBase64: false }),
    BesatTable.configure({ resizable: mode === "advanced" }),
    TableRow,
    BesatTableHeader,
    BesatTableCell,
    TextAlign.configure({
      types: ["heading", "paragraph", "tableCell", "tableHeader"],
    }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
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

const STRUCTURE_OPTIONS: Array<{ level: 0 | 2 | 3 | 4; label: string }> = [
  { level: 0, label: "پاراگراف" },
  { level: 2, label: "H2 — عنوان بخش" },
  { level: 3, label: "H3 — عنوان فرعی" },
  { level: 4, label: "H4 — زیربخش" },
];

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
  const [linkNewTab, setLinkNewTab] = useState(false);
  const [structureOpen, setStructureOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      subscript: current.isActive("subscript"),
      superscript: current.isActive("superscript"),
      paragraph: current.isActive("paragraph"),
      h2: current.isActive("heading", { level: 2 }),
      h3: current.isActive("heading", { level: 3 }),
      h4: current.isActive("heading", { level: 4 }),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      blockquote: current.isActive("blockquote"),
      codeBlock: current.isActive("codeBlock"),
      link: current.isActive("link"),
      alignRight: current.isActive({ textAlign: "right" }),
      alignCenter: current.isActive({ textAlign: "center" }),
      alignLeft: current.isActive({ textAlign: "left" }),
      alignJustify: current.isActive({ textAlign: "justify" }),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  const activeStructureLabel = state.h2 ? "H2" : state.h3 ? "H3" : state.h4 ? "H4" : "متن";

  function setStructure(level: 0 | 2 | 3 | 4) {
    if (level === 0) editor.chain().focus().setParagraph().run();
    else editor.chain().focus().setNode("heading", { level }).run();
    setStructureOpen(false);
  }

  function openLinkEditor() {
    setLinkValue((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkNewTab((editor.getAttributes("link").target as string | undefined) === "_blank");
    setLinkOpen(true);
  }

  function applyLink() {
    const href = linkValue.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({
        href,
        target: linkNewTab ? "_blank" : null,
        rel: linkNewTab ? "noopener noreferrer" : null,
      }).run();
    }
    setLinkOpen(false);
  }

  function removeLink() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  }

  return (
    <div className="besat-editor-toolbar">
      <div className="besat-editor-toolbar-scroll">
        <ToolbarButton title="واگرد" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}><ToolbarIcon name="undo" /></ToolbarButton>
        <ToolbarButton title="ازنو" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}><ToolbarIcon name="redo" /></ToolbarButton>
        <Divider />
        <ToolbarButton title="درشت" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}><ToolbarIcon name="bold" /></ToolbarButton>
        <ToolbarButton title="مورب" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><ToolbarIcon name="italic" /></ToolbarButton>
        <ToolbarButton title="زیرخط" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><ToolbarIcon name="underline" /></ToolbarButton>
        <ToolbarButton title="خط‌خورده" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><ToolbarIcon name="strike" /></ToolbarButton>
        <Divider />
        <div className="besat-editor-toolbar-dropdown">
          <ToolbarButton title="ساختار متن" onClick={() => setStructureOpen((value) => !value)}>
            <span className="text-[11px] font-black">{activeStructureLabel}</span>
          </ToolbarButton>
          {structureOpen ? (
            <div className="besat-editor-toolbar-menu" role="menu">
              {STRUCTURE_OPTIONS.map((option) => (
                <button key={option.level} type="button" role="menuitem" onClick={() => setStructure(option.level)}>
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <Divider />
        <ToolbarButton title="فهرست نقطه‌ای" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}><ToolbarIcon name="bullet-list" /></ToolbarButton>
        <ToolbarButton title="فهرست شماره‌دار" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ToolbarIcon name="ordered-list" /></ToolbarButton>
        <ToolbarButton title="نقل‌قول" active={state.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}><ToolbarIcon name="quote" /></ToolbarButton>
        {mode === "advanced" ? <ToolbarButton title="بلوک کد" active={state.codeBlock} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><ToolbarIcon name="code" /></ToolbarButton> : null}
        <Divider />
        <ToolbarButton title="راست‌چین" active={state.alignRight} onClick={() => editor.chain().focus().setTextAlign("right").run()}><ToolbarIcon name="align-right" /></ToolbarButton>
        <ToolbarButton title="وسط‌چین" active={state.alignCenter} onClick={() => editor.chain().focus().setTextAlign("center").run()}><ToolbarIcon name="align-center" /></ToolbarButton>
        <ToolbarButton title="چپ‌چین" active={state.alignLeft} onClick={() => editor.chain().focus().setTextAlign("left").run()}><ToolbarIcon name="align-left" /></ToolbarButton>
        <ToolbarButton title="دوطرفه‌چین" active={state.alignJustify} onClick={() => editor.chain().focus().setTextAlign("justify").run()}><span className="text-[10px] font-black">≡</span></ToolbarButton>
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
        <div className="besat-editor-toolbar-dropdown">
          <ToolbarButton title="قالب‌بندی بیشتر" onClick={() => setMoreOpen((value) => !value)}><ToolbarIcon name="more" /></ToolbarButton>
          {moreOpen ? (
            <div className="besat-editor-toolbar-menu besat-editor-toolbar-menu--wide" role="menu">
              <p className="besat-editor-toolbar-menu-label">رنگ متن</p>
              <div className="besat-editor-toolbar-swatches">
                {TEXT_COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.value}
                    type="button"
                    title={swatch.label}
                    aria-label={swatch.label}
                    style={{ backgroundColor: swatch.value }}
                    onClick={() => editor.chain().focus().setColor(swatch.value).run()}
                  />
                ))}
                <button type="button" title="حذف رنگ" aria-label="حذف رنگ" className="besat-editor-toolbar-swatch-clear" onClick={() => editor.chain().focus().unsetColor().run()}>
                  <EditorIcon name="close" className="size-3" />
                </button>
              </div>
              <p className="besat-editor-toolbar-menu-label">هایلایت</p>
              <div className="besat-editor-toolbar-swatches">
                {HIGHLIGHT_COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.value}
                    type="button"
                    title={swatch.label}
                    aria-label={swatch.label}
                    style={{ backgroundColor: swatch.value }}
                    onClick={() => editor.chain().focus().setHighlight({ color: swatch.value }).run()}
                  />
                ))}
                <button type="button" title="حذف هایلایت" aria-label="حذف هایلایت" className="besat-editor-toolbar-swatch-clear" onClick={() => editor.chain().focus().unsetHighlight().run()}>
                  <EditorIcon name="close" className="size-3" />
                </button>
              </div>
              <div className="besat-editor-toolbar-menu-row">
                <button type="button" role="menuitemcheckbox" aria-checked={state.subscript} className={state.subscript ? "is-active" : ""} onClick={() => editor.chain().focus().toggleSubscript().run()}>زیرنویس</button>
                <button type="button" role="menuitemcheckbox" aria-checked={state.superscript} className={state.superscript ? "is-active" : ""} onClick={() => editor.chain().focus().toggleSuperscript().run()}>بالانویس</button>
              </div>
              <button
                type="button"
                role="menuitem"
                className="besat-editor-toolbar-menu-danger"
                onClick={() => { editor.chain().focus().unsetAllMarks().clearNodes().run(); setMoreOpen(false); }}
              >
                پاک‌کردن قالب‌بندی
              </button>
            </div>
          ) : null}
        </div>
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
          <label className="besat-editor-link-popover-checkbox">
            <input type="checkbox" checked={linkNewTab} onChange={(event) => setLinkNewTab(event.target.checked)} />
            <span>باز شدن در تب جدید</span>
          </label>
          {state.link ? (
            <button type="button" onClick={removeLink} aria-label="حذف لینک" className="besat-editor-link-popover-remove"><EditorIcon name="trash" /></button>
          ) : null}
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

function moveTopLevelBlock(editor: Editor, fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return;
  const json = editor.getJSON();
  const blocks = [...(json.content ?? [])];
  if (!blocks[fromIndex] || toIndex < 0 || toIndex >= blocks.length) return;
  const [moved] = blocks.splice(fromIndex, 1);
  blocks.splice(toIndex, 0, moved);
  editor.commands.setContent({ ...json, content: blocks }, { emitUpdate: true });
}

function duplicateTopLevelBlock(editor: Editor, index: number) {
  const json = editor.getJSON();
  const blocks = [...(json.content ?? [])];
  if (!blocks[index]) return;
  blocks.splice(index + 1, 0, JSON.parse(JSON.stringify(blocks[index])) as (typeof blocks)[number]);
  editor.commands.setContent({ ...json, content: blocks }, { emitUpdate: true });
}

function deleteTopLevelBlock(editor: Editor, index: number) {
  const json = editor.getJSON();
  const blocks = [...(json.content ?? [])];
  if (!blocks[index]) return;
  blocks.splice(index, 1);
  editor.commands.setContent(
    { ...json, content: blocks.length ? blocks : [{ type: "paragraph" }] },
    { emitUpdate: true },
  );
}

// Table has no custom NodeView (the stock one keeps colgroup/column-resize
// working), so the selection can be a plain TextSelection nested inside a
// cell rather than a NodeSelection on the table itself. This walks up the
// resolved position to find the enclosing table's own position, which is
// what editor.view.nodeDOM() needs to locate its real DOM element for the
// floating settings-trigger button.
function resolveAncestorPos(state: EditorState, typeName: string): number | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === typeName) {
      return $from.before(depth);
    }
  }
  return null;
}

const ACTIVE_BLOCK_NODE_TYPES: Array<[ActiveBlockKind, string]> = [
  ["table", "table"],
  ["image", "image"],
  ["gallery", "besatGalleryBlock"],
  ["media", "besatMediaBlock"],
  ["quote", "besatQuoteBlock"],
  ["callout", "besatCalloutBlock"],
  ["embed", "besatEmbedBlock"],
];

function buildTableCommands(editor: Editor): TableCommands {
  const run = (fn: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) =>
    fn(editor.chain().focus()).run();
  return {
    addRowBefore: () => run((c) => c.addRowBefore()),
    addRowAfter: () => run((c) => c.addRowAfter()),
    deleteRow: () => run((c) => c.deleteRow()),
    addColumnBefore: () => run((c) => c.addColumnBefore()),
    addColumnAfter: () => run((c) => c.addColumnAfter()),
    deleteColumn: () => run((c) => c.deleteColumn()),
    mergeCells: () => run((c) => c.mergeCells()),
    splitCell: () => run((c) => c.splitCell()),
    toggleHeaderRow: () => run((c) => c.toggleHeaderRow()),
    toggleHeaderColumn: () => run((c) => c.toggleHeaderColumn()),
    deleteTable: () => run((c) => c.deleteTable()),
    setCellVerticalAlign: (align) =>
      run((c) => c.updateAttributes("tableCell", { verticalAlign: align }).updateAttributes("tableHeader", { verticalAlign: align })),
  };
}

function computeActiveBlock(editor: Editor): ActiveBlockContext | null {
  for (const [kind, nodeType] of ACTIVE_BLOCK_NODE_TYPES) {
    if (!editor.isActive(nodeType)) continue;

    const attrs = editor.getAttributes(nodeType);
    const index = editor.state.doc.resolve(editor.state.selection.from).index(0);
    const lastIndex = editor.state.doc.childCount - 1;

    return {
      kind,
      index,
      attrs,
      // No .focus() here: this is bound to Inspector <input>/<textarea>
      // onChange handlers in the side panel. Re-focusing the ProseMirror
      // content on every keystroke would yank browser focus away from the
      // field the user is actively typing into (each keystroke would land
      // back in the editor canvas instead of the input). updateAttributes
      // doesn't need DOM focus -- it dispatches a transaction against the
      // node at the current selection regardless.
      updateAttrs: (patch) => editor.chain().updateAttributes(nodeType, patch).run(),
      moveUp: () => moveTopLevelBlock(editor, index, index - 1),
      moveDown: () => moveTopLevelBlock(editor, index, index + 1),
      duplicate: () => duplicateTopLevelBlock(editor, index),
      remove: () => deleteTopLevelBlock(editor, index),
      canMoveUp: index > 0,
      canMoveDown: index < lastIndex,
      table: kind === "table" ? buildTableCommands(editor) : undefined,
    };
  }
  return null;
}

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(function RichEditor({
  value,
  onChange,
  jsonValue,
  onJsonChange,
  mode = "simple",
  onOutlineChange,
  onStatsChange,
  onActiveBlockChange,
  onTableSettingsClick,
  onUploadMedia,
  onUploadState,
  placeholder,
}, ref) {
  const isInternalUpdate = useRef(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const replaceImageInput = useRef<HTMLInputElement>(null);
  // FE-CMS-RICH-EDITOR-UPLOAD-DOUBLE-SUBMIT-001: onUploadState is
  // state-backed (reported to the parent, not read synchronously here), so
  // two same-tick file selections on the same input both started an
  // upload. Per-channel refs -- not a guard inside uploadAndInsert itself
  // -- because uploadAndInsert is also called once per file for a
  // legitimate multi-file drag/drop or paste batch, which must stay
  // concurrent.
  const toolbarUploadingRef = useRef(false);
  const replaceUploadingRef = useRef(false);
  const [tableTriggerRect, setTableTriggerRect] = useState<{ top: number; right: number } | null>(null);

  // CMS-TABLE-FORGED-COLWIDTH-001-R1: the backend now sanitizes every
  // editor_json it hands back, but this editor isn't the only possible
  // source of a document (pasted/imported content, a future data source),
  // so it clamps colwidth again at its own hydration boundary too --
  // cloned first since sanitizeStoredTiptapDocument mutates in place and
  // this prop may be held elsewhere by the caller's own state.
  const sanitizedJsonValue = useMemo(
    () => (jsonValue ? sanitizeStoredTiptapDocument(structuredClone(jsonValue)) : jsonValue),
    [jsonValue],
  );

  // FE-CMS-EDITOR-UPLOAD-SAVE-RACE-001: onUploadState was previously called
  // directly, true/false, around each individual upload call site
  // (uploadAndInsert's own single upload, and the separate replace-image
  // flow). Two uploads overlapping -- a multi-file paste/drop, or a
  // paste racing a replace-image action -- meant the FIRST one to finish
  // reported `false` to the parent while the second was still in flight,
  // which let a listener (editorial-workspace.tsx's cosmetic status label)
  // believe uploading had ended when it hadn't. Reference-counting here,
  // at the one place both call sites route through, only reports `false`
  // once every concurrent upload has actually settled. State (not a ref)
  // because beginUpload/endUpload are reachable, via onDrop/onPaste, from
  // the extensions array built on every render for useEditor() -- eslint's
  // react-hooks/refs rule forbids a ref read reachable from render, even
  // though these particular calls only ever actually run from a real
  // paste/drop event handler.
  const [activeUploadCount, setActiveUploadCount] = useState(0);
  const beginUpload = useCallback(() => {
    setActiveUploadCount((count) => count + 1);
  }, []);
  const endUpload = useCallback(() => {
    setActiveUploadCount((count) => Math.max(0, count - 1));
  }, []);
  useEffect(() => {
    onUploadState?.(activeUploadCount > 0);
  }, [activeUploadCount, onUploadState]);

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

  const emitActiveBlock = useCallback((current: Editor) => {
    onActiveBlockChange?.(computeActiveBlock(current));
  }, [onActiveBlockChange]);

  // Positions the small settings badge over the selected table's top
  // corner. Recomputed on every selection change, not just on click, so it
  // tracks the caret moving between tables/out of tables; kept separate
  // from computeActiveBlock() since it needs editor.view.nodeDOM(), a DOM
  // lookup that has no place in the plain-data ActiveBlockContext.
  const updateTableTriggerRect = useCallback((current: Editor) => {
    if (!current.isActive("table")) {
      setTableTriggerRect(null);
      return;
    }
    const pos = resolveAncestorPos(current.state, "table");
    const dom = pos == null ? null : (current.view.nodeDOM(pos) as HTMLElement | null);
    if (!dom) {
      setTableTriggerRect(null);
      return;
    }
    const rect = dom.getBoundingClientRect();
    setTableTriggerRect({ top: rect.top, right: rect.right });
  }, []);

  async function uploadAndInsert(current: Editor, file: File, position?: number) {
    beginUpload();
    try {
      if (!onUploadMedia) {
        throw new Error("برای بارگذاری رسانه، اتصال سرویس رسانه الزامی است.");
      }
      const uploaded = await onUploadMedia(file);
      // FE-CMS-EDITOR-UPLOAD-UNMOUNT-001: the CMS panel (and this whole
      // RichEditor) can be closed/unmounted while a real upload is still
      // in flight -- TipTap's own useEditor cleanup destroys `current`
      // (the same Editor instance this async call already captured) the
      // moment that happens. Resuming afterward and calling .chain() on a
      // destroyed editor throws (its internal view is torn down), so the
      // upload must become a safe no-op once the editor it was meant to
      // insert into no longer exists -- there is nothing left to insert
      // into, and nothing the user can still see the result of.
      if (current.isDestroyed) return;
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
      endUpload();
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
    content: sanitizedJsonValue ?? value,
    editorProps: {
      attributes: {
        dir: "rtl",
        class: `besat-rich-content besat-editor-canvas ${mode === "advanced" ? "is-advanced" : "is-simple"}`,
        // A bare contenteditable <div> has an implicit ARIA role of
        // "generic", which does not support name calculation from
        // aria-label -- Axe's aria-prohibited-attr flags it. role="textbox"
        // (the standard accessibility contract for a rich-text editor
        // surface) plus aria-multiline makes aria-label valid here.
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "متن محتوا",
      },
    },
    onCreate({ editor: current }) {
      emitDerivedState(current);
      emitActiveBlock(current);
      updateTableTriggerRect(current);
    },
    onUpdate({ editor: current }) {
      isInternalUpdate.current = true;
      onChange(current.getHTML());
      onJsonChange?.(current.getJSON());
      emitDerivedState(current);
      emitActiveBlock(current);
      updateTableTriggerRect(current);
    },
    onSelectionUpdate({ editor: current }) {
      emitActiveBlock(current);
      updateTableTriggerRect(current);
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

  // getBoundingClientRect() is viewport-relative, so the badge (position:
  // fixed) drifts on scroll/resize unless it's recomputed -- selection
  // changes alone don't cover "scrolled the page without touching the
  // editor", so this listens for that separately while a table trigger is
  // actually showing.
  const tableTriggerVisible = tableTriggerRect !== null;
  useEffect(() => {
    if (!editor || !tableTriggerVisible) return;
    function handle() {
      if (editor) updateTableTriggerRect(editor);
    }
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
  }, [editor, tableTriggerVisible, updateTableTriggerRect]);

  useImperativeHandle(ref, () => ({
    insertHtml(html) {
      editor?.chain().focus().insertContent(html).run();
    },
    moveBlock(fromIndex, toIndex) {
      if (!editor) return;
      moveTopLevelBlock(editor, fromIndex, toIndex);
    },
    duplicateBlock(index) {
      if (!editor) return;
      duplicateTopLevelBlock(editor, index);
    },
    deleteBlock(index) {
      if (!editor) return;
      deleteTopLevelBlock(editor, index);
    },
    replaceImage() {
      if (!editor?.isActive("image")) return;
      replaceImageInput.current?.click();
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
    if (sanitizedJsonValue) {
      if (JSON.stringify(sanitizedJsonValue) !== JSON.stringify(editor.getJSON())) {
        editor.commands.setContent(sanitizedJsonValue, { emitUpdate: false });
        emitDerivedState(editor);
      }
    } else if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
      emitDerivedState(editor);
    }
  }, [value, sanitizedJsonValue, editor, emitDerivedState]);

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
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (!file || toolbarUploadingRef.current) return;
          toolbarUploadingRef.current = true;
          void uploadAndInsert(editor, file).finally(() => {
            toolbarUploadingRef.current = false;
          });
        }}
      />
      <input
        ref={replaceImageInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (!file || !onUploadMedia || !editor.isActive("image") || replaceUploadingRef.current) return;
          replaceUploadingRef.current = true;
          beginUpload();
          onUploadMedia(file)
            .then((uploaded) => {
              // FE-CMS-EDITOR-UPLOAD-UNMOUNT-001: same guard as
              // uploadAndInsert() -- the editor can be destroyed while
              // this upload was in flight.
              if (editor.isDestroyed) return;
              editor.chain().focus().updateAttributes("image", {
                src: uploaded.url,
                alt: uploaded.alt_text ?? file.name,
              }).run();
            })
            .finally(() => {
              endUpload();
              replaceUploadingRef.current = false;
            });
        }}
      />
      <Toolbar editor={editor} mode={mode} onChooseImage={() => imageInput.current?.click()} />
      <EditorContent editor={editor} />
      {tableTriggerRect ? (
        <button
          type="button"
          className="besat-table-settings-trigger"
          style={{ top: tableTriggerRect.top, left: tableTriggerRect.right }}
          aria-label="تنظیمات جدول"
          title="تنظیمات جدول"
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onTableSettingsClick?.();
          }}
        >
          <EditorIcon name="settings" className="size-[1.05rem]" />
        </button>
      ) : null}
    </div>
  );
});
