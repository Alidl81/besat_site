"use client";

import type { ReactNode } from "react";
import { EditorIcon, type EditorIconName } from "@/components/editor/editor-icons";
import type {
  EditorOutlineItem,
  RichEditorHandle,
} from "@/components/editor/rich-editor";

type EditorDocumentOutlineProps = {
  editorRef: React.RefObject<RichEditorHandle | null>;
  outline: EditorOutlineItem[];
  /**
   * The special/structured Besat block cards (gallery, single media, quote,
   * callout, embed) -- the ONLY things this side panel inserts. Ordinary
   * editor primitives (paragraph, heading, divider, table, code) live on
   * the main TipTap toolbar instead, not here, so there is exactly one
   * insertion path for each block type.
   */
  children?: ReactNode;
  /**
   * When a complex block's settings should be shown, this replaces the
   * "بلوک‌های ویژه" card grid with that block's Inspector -- the outline
   * list above stays visible either way. Most complex blocks (gallery,
   * image, quote, callout, embed) switch to this automatically on
   * selection. Two deliberate exceptions never do: Table only passes an
   * inspector here after the caller sees an explicit click on the table's
   * own settings trigger (see RichEditor's onTableSettingsClick /
   * besat-table-settings-trigger button), so simply moving the caret
   * through a table while writing prose doesn't keep yanking this panel
   * away from the special-block cards; Code never does at all (see
   * FE-CMS-SIDEBAR-ORDINARY-001) -- code configuration lives only on the
   * main toolbar, so "codeBlock" was removed from ActiveBlockKind entirely
   * and can never reach this prop.
   */
  inspector?: ReactNode;
};

const typeLabels: Record<string, string> = {
  besatGalleryBlock: "گالری",
  besatMediaBlock: "رسانه",
  besatQuoteBlock: "نقل‌قول",
  besatCalloutBlock: "متن برجسته",
  besatEmbedBlock: "ویدئو",
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
  besatMediaBlock: "image",
  besatQuoteBlock: "quote",
  besatCalloutBlock: "alert-circle",
  besatEmbedBlock: "video",
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

export function EditorDocumentOutline({
  editorRef,
  outline,
  children,
  inspector,
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

      {inspector ?? (
        <>
          <div className="besat-editor-insert-heading">بلوک‌های ویژه</div>
          <p className="besat-editor-insert-hint">
            پاراگراف، عنوان، جدول، جداکننده و کد از نوار ابزار اصلی افزوده می‌شوند.
          </p>
          <div className="besat-editor-insert-grid" aria-label="بلوک‌های ویژه">
            {children}
          </div>
        </>
      )}
    </section>
  );
}
