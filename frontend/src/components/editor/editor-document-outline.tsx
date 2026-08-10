"use client";

import { EditorIcon, type EditorIconName } from "@/components/editor/editor-icons";
import type {
  EditorBlockType,
  EditorOutlineItem,
  RichEditorHandle,
} from "@/components/editor/rich-editor";

type EditorDocumentOutlineProps = {
  editorRef: React.RefObject<RichEditorHandle | null>;
  outline: EditorOutlineItem[];
};

const typeLabels: Record<string, string> = {
  besatGalleryBlock: "گالری",
  blockquote: "نقل‌قول",
  bulletList: "فهرست",
  codeBlock: "کد",
  heading: "عنوان",
  horizontalRule: "جداکننده",
  image: "تصویر",
  orderedList: "فهرست",
  paragraph: "متن",
  table: "جدول",
};

const typeIcons: Record<string, EditorIconName> = {
  besatGalleryBlock: "gallery",
  blockquote: "quote",
  bulletList: "bullet-list",
  codeBlock: "code",
  heading: "heading",
  horizontalRule: "divider",
  image: "image",
  orderedList: "ordered-list",
  paragraph: "paragraph",
  table: "table",
};

const insertItems: Array<{
  type: EditorBlockType;
  label: string;
  icon: EditorIconName;
}> = [
  { type: "heading", label: "عنوان", icon: "heading" },
  { type: "paragraph", label: "پاراگراف", icon: "paragraph" },
  { type: "image", label: "تصویر", icon: "image" },
  { type: "gallery", label: "گالری", icon: "gallery" },
  { type: "quote", label: "نقل‌قول", icon: "quote" },
  { type: "table", label: "جدول", icon: "table" },
  { type: "divider", label: "جداکننده", icon: "divider" },
  { type: "code", label: "کد", icon: "code" },
];

export function EditorDocumentOutline({
  editorRef,
  outline,
}: EditorDocumentOutlineProps) {
  return (
    <section className="besat-editor-side-card" aria-labelledby="editor-outline-title">
      <header className="besat-editor-side-heading">
        <div>
          <h3 id="editor-outline-title">ساختار محتوا</h3>
          <p>{outline.length.toLocaleString("fa-IR")} بلوک در این نوشته</p>
        </div>
        <EditorIcon name="grip" />
      </header>

      <div className="besat-editor-outline" aria-label="فهرست بلوک‌های محتوا">
        {outline.length ? outline.map((item) => (
          <article key={`${item.index}-${item.type}-${item.label}`} className="besat-editor-outline-row">
            <button
              type="button"
              className="besat-editor-outline-main"
              onClick={() => editorRef.current?.focusBlock(item.index)}
              aria-label={`رفتن به ${item.label}`}
            >
              <EditorIcon name="grip" className="besat-editor-outline-grip" />
              <span className="besat-editor-outline-icon">
                <EditorIcon name={typeIcons[item.type] ?? "paragraph"} />
              </span>
              <span>
                <b>{item.label}</b>
                <small>{typeLabels[item.type] ?? "بلوک محتوا"}</small>
              </span>
            </button>

            <div className="besat-editor-outline-actions">
              <button
                type="button"
                disabled={item.index === 0}
                onClick={() => editorRef.current?.moveBlock(item.index, item.index - 1)}
                aria-label={`انتقال ${item.label} به بالا`}
                title="انتقال به بالا"
              >
                <EditorIcon name="chevron-up" />
              </button>
              <button
                type="button"
                disabled={item.index === outline.length - 1}
                onClick={() => editorRef.current?.moveBlock(item.index, item.index + 1)}
                aria-label={`انتقال ${item.label} به پایین`}
                title="انتقال به پایین"
              >
                <EditorIcon name="chevron-down" />
              </button>
              <button
                type="button"
                onClick={() => editorRef.current?.duplicateBlock(item.index)}
                aria-label={`تکثیر ${item.label}`}
                title="تکثیر"
              >
                <EditorIcon name="duplicate" />
              </button>
              <button
                type="button"
                onClick={() => editorRef.current?.deleteBlock(item.index)}
                aria-label={`حذف ${item.label}`}
                title="حذف"
                className="is-danger"
              >
                <EditorIcon name="trash" />
              </button>
            </div>
          </article>
        )) : (
          <p className="besat-editor-outline-empty">هنوز بلوکی اضافه نشده است.</p>
        )}
      </div>

      <div className="besat-editor-insert-grid" aria-label="افزودن بلوک">
        {insertItems.map((item) => (
          <button
            key={item.type}
            type="button"
            onClick={() => editorRef.current?.insertBlock(item.type)}
          >
            <EditorIcon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
