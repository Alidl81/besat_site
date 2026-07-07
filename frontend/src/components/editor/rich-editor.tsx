"use client";

import { Node as TiptapNode, mergeAttributes } from "@tiptap/core";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { useEffect, useRef, type ReactNode } from "react";

type RichEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

type GalleryMediaItem = {
  src: string;
  type: "image" | "video";
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

    return parsed
      .filter((item) => typeof item?.src === "string" && item.src.length > 0)
      .map((item) => ({
        src: item.src,
        type: item.type === "video" ? "video" : "image",
      }));
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

function isVideoSource(src: string) {
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
    const src = item.getAttribute("data-src") ?? "";
    const type = item.getAttribute("data-type") === "video" || isVideoSource(src) ? "video" : "image";

    if (src) items.push({ src: decodeHtml(src), type });
  }

  if (items.length > 0) return items;

  const mediaItems = Array.from(element.querySelectorAll<HTMLImageElement | HTMLVideoElement>("img, video"));

  for (const item of mediaItems) {
    const src = item.getAttribute("src") ?? "";
    const type = item.tagName.toLowerCase() === "video" || isVideoSource(src) ? "video" : "image";

    if (src) items.push({ src: decodeHtml(src), type });
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
    selected ? "border-emerald-400" : "border-slate-200",
    selected ? "ring-4" : "",
    selected ? "ring-emerald-100" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function createGalleryNodeView({
  node,
  editor,
  getPos,
}: {
  node: any;
  editor: Editor;
  getPos: (() => number) | boolean;
}) {
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

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "flex min-h-44 items-center justify-center rounded-[1.3rem] border border-dashed border-slate-200 bg-white text-sm font-bold text-slate-400";
      empty.textContent = "بلوک گالری خالی است.";
      grid.appendChild(empty);
      return;
    }

    for (const item of items) {
      const frame = document.createElement("div");
      frame.className = "overflow-hidden rounded-[1.3rem] border border-slate-200 bg-white";

      if (isScrollable) {
        frame.style.width = "clamp(9rem, 31%, 18rem)";
        frame.style.flex = "0 0 clamp(9rem, 31%, 18rem)";
      }

      if (item.type === "video") {
        const video = document.createElement("video");
        video.src = item.src;
        video.muted = true;
        video.className = "w-full bg-slate-950 object-cover";
        video.style.height = height;
        frame.appendChild(video);
      } else {
        const image = document.createElement("img");
        image.src = item.src;
        image.alt = "";
        image.className = "w-full bg-slate-100 object-cover";
        image.style.height = height;
        frame.appendChild(image);
      }

      grid.appendChild(frame);
    }
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
      className: "absolute right-[-0.45rem] top-[-0.45rem] size-4 rounded-md border border-emerald-500 bg-white shadow",
    },
    {
      corner: "top-left",
      className: "absolute left-[-0.45rem] top-[-0.45rem] size-4 rounded-md border border-emerald-500 bg-white shadow",
    },
    {
      corner: "bottom-right",
      className: "absolute bottom-[-0.45rem] right-[-0.45rem] size-4 rounded-md border border-emerald-500 bg-white shadow",
    },
    {
      corner: "bottom-left",
      className: "absolute bottom-[-0.45rem] left-[-0.45rem] size-4 rounded-md border border-emerald-500 bg-white shadow",
    },
  ];

  for (const handle of handles) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", "resize");
    button.className = handle.className;
    button.addEventListener("mousedown", (event) => startResize(handle.corner, event));
    dom.appendChild(button);
  }

  render();

  return {
    dom,
    update(updatedNode: any) {
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

const BesatGalleryBlock = TiptapNode.create({
  name: "besatGalleryBlock",

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
    return (props) => createGalleryNodeView(props as any);
  },
});

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-sm font-black transition ${
        active
          ? "bg-[#062452] text-white"
          : "bg-white text-[#062452] hover:bg-slate-100"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-6 w-px bg-slate-200" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  function addImage() {
    const url = window.prompt("نشانی تصویر (URL):");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }

  function setLink() {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("نشانی لینک (URL):", previous ?? "");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2">
      <ToolbarButton
        title="درشت"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-black">B</span>
      </ToolbarButton>
      <ToolbarButton
        title="مورب"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        title="زیرخط"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </ToolbarButton>
      <ToolbarButton
        title="خط‌خورده"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <span className="line-through">S</span>
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        title="عنوان ۱"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        title="عنوان ۲"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        title="عنوان ۳"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        title="فهرست نقطه‌ای"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •
      </ToolbarButton>
      <ToolbarButton
        title="فهرست عددی"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        ۱.
      </ToolbarButton>
      <ToolbarButton
        title="نقل‌قول"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        ❝
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        title="راست‌چین"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        ⇥
      </ToolbarButton>
      <ToolbarButton
        title="وسط‌چین"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        ☰
      </ToolbarButton>
      <ToolbarButton
        title="چپ‌چین"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        ⇤
      </ToolbarButton>

      <Divider />

      <ToolbarButton title="لینک" active={editor.isActive("link")} onClick={setLink}>
        🔗
      </ToolbarButton>
      <ToolbarButton title="تصویر" onClick={addImage}>
        🖼
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        title="واگرد"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        ↺
      </ToolbarButton>
      <ToolbarButton
        title="ازنو"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        ↻
      </ToolbarButton>
    </div>
  );
}

export function RichEditor({ value, onChange, placeholder }: RichEditorProps) {
  const isInternalUpdate = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      BesatGalleryBlock,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({
        placeholder: placeholder ?? "متن محتوای خود را اینجا بنویسید...",
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        dir: "rtl",
        class:
          "besat-rich-content min-h-[18rem] max-w-none px-5 py-4 text-right text-sm leading-8 text-[#062452] outline-none",
      },
    },
    onUpdate({ editor: ed }) {
      isInternalUpdate.current = true;
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="min-h-[22rem] rounded-2xl border border-slate-200 bg-slate-50" />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}