import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import {
  createRichEditorDocumentExtensions,
} from "@/components/editor/rich-editor";
import {
  buildCalloutBlockHtml,
  buildEmbedBlockHtml,
  buildGalleryBlockHtml,
  buildMediaBlockHtml,
  buildQuoteBlockHtml,
} from "@/lib/editor/structured-content";

describe("RichEditor supported block round trip", () => {
  it("retains supported structured blocks and editorial metadata", () => {
    const content = [
      '<p style="text-align: center">پاراگراف وسط‌چین</p>',
      '<table><colgroup><col width="120"><col width="160"></colgroup><tbody><tr><th colwidth="120">سرستون</th><td colwidth="160" style="text-align: right">سلول راست‌چین</td></tr></tbody></table>',
      buildGalleryBlockHtml([
        {
          id: "asset-1",
          src: "/media/gallery.jpg",
          type: "image",
          alt: "تصویر گالری",
          caption: "زیرنویس گالری",
          credit: "روابط عمومی",
        },
        {
          src: "https://cdn.example.test/clip.mp4",
          type: "video",
          title: "ویدئوی گالری",
        },
      ]),
      buildMediaBlockHtml({
        src: "/media/feature.jpg",
        type: "image",
        alt: "تصویر شاخص",
        caption: "زیرنویس تصویر",
        credit: "عکاس",
      }),
      buildMediaBlockHtml({
        src: "https://cdn.example.test/feature.mp4",
        type: "video",
        caption: "زیرنویس ویدئو",
      }),
      buildQuoteBlockHtml("متن نقل‌قول", "منبع نقل‌قول"),
      buildCalloutBlockHtml("یادآوری", "متن برجسته", "تحریریه", "warning"),
      buildEmbedBlockHtml("https://youtu.be/abcDEF123", "ویدئوی مراسم", "زیرنویس ویدئو"),
    ].join("");

    const editor = new Editor({
      extensions: createRichEditorDocumentExtensions("advanced"),
      content,
    });

    try {
      const result = editor.getHTML();
      expect(result).toContain("text-align");
      expect(result).toContain("<table");
      expect(result).toContain("<colgroup>");
      expect(result).toContain("width: 120px");
      expect(result).toContain("width: 160px");
      expect(result).toContain('data-besat-block="gallery"');
      expect(result).toContain('data-alt="تصویر گالری"');
      expect(result).toContain('data-caption="زیرنویس گالری"');
      expect(result).toContain('data-credit="روابط عمومی"');
      expect(result).toContain('data-besat-block="media"');
      expect(result).toContain("زیرنویس تصویر");
      expect(result).toContain('data-media-type="video"');
      expect(result).toContain("زیرنویس ویدئو");
      expect(result).toContain('data-besat-block="quote"');
      expect(result).toContain("منبع نقل‌قول");
      expect(result).toContain('data-besat-block="callout"');
      expect(result).toContain('data-tone="warning"');
      expect(result).toContain('data-besat-block="embed"');
      expect(result).toContain("youtube-nocookie.com/embed/abcDEF123");
    } finally {
      editor.destroy();
    }
  });

  it("persists gallery item add/reorder/remove/alt/caption edits through the same attrs update the node view uses", () => {
    const content = buildGalleryBlockHtml([
      { id: "item-a", src: "/media/a.jpg", type: "image", alt: "الف", caption: "کپشن الف" },
      { id: "item-b", src: "/media/b.jpg", type: "image", alt: "ب", caption: "کپشن ب" },
    ]);

    const editor = new Editor({
      extensions: createRichEditorDocumentExtensions("advanced"),
      content,
    });

    try {
      let galleryPos = -1;
      let galleryNode: ReturnType<typeof editor.state.doc.nodeAt> = null;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "besatGalleryBlock") {
          galleryPos = pos;
          galleryNode = node;
        }
      });
      expect(galleryPos).toBeGreaterThanOrEqual(0);
      expect(galleryNode).not.toBeNull();

      type Item = { id?: string; src: string; type: string; alt?: string; caption?: string; title?: string; credit?: string };
      const items = JSON.parse(galleryNode!.attrs.items as string) as Item[];
      expect(items).toHaveLength(2);

      // Reorder (swap), edit alt/caption on the moved item, and add a third
      // item — the same JSON-array-then-setNodeMarkup mechanism the node
      // view's moveItem/updateItemField/addFiles use internally.
      const reordered = [items[1], items[0]];
      reordered[0] = { ...reordered[0], alt: "ب ویرایش‌شده", caption: "کپشن ب ویرایش‌شده" };
      reordered.push({ id: "item-c", src: "/media/c.jpg", type: "image", alt: "ج", caption: "کپشن ج" });

      editor.view.dispatch(
        editor.state.tr.setNodeMarkup(galleryPos, undefined, {
          ...galleryNode!.attrs,
          items: JSON.stringify(reordered),
        }),
      );

      const html = editor.getHTML();
      const order = [...html.matchAll(/data-src="([^"]+)"/g)].map((match) => match[1]);
      expect(order).toEqual(["/media/b.jpg", "/media/a.jpg", "/media/c.jpg"]);
      expect(html).toContain('data-alt="ب ویرایش‌شده"');
      expect(html).toContain('data-caption="کپشن ب ویرایش‌شده"');

      // Remove the middle item.
      let updatedPos = -1;
      let updatedNode: ReturnType<typeof editor.state.doc.nodeAt> = null;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "besatGalleryBlock") {
          updatedPos = pos;
          updatedNode = node;
        }
      });
      const afterReorder = JSON.parse(updatedNode!.attrs.items as string) as Item[];
      const afterRemoval = afterReorder.filter((_, index) => index !== 1);

      editor.view.dispatch(
        editor.state.tr.setNodeMarkup(updatedPos, undefined, {
          ...updatedNode!.attrs,
          items: JSON.stringify(afterRemoval),
        }),
      );

      const finalHtml = editor.getHTML();
      const finalOrder = [...finalHtml.matchAll(/data-src="([^"]+)"/g)].map((match) => match[1]);
      expect(finalOrder).toEqual(["/media/b.jpg", "/media/c.jpg"]);

      // Round-trip through a fresh editor instance (simulating reload).
      const reloaded = new Editor({
        extensions: createRichEditorDocumentExtensions("advanced"),
        content: finalHtml,
      });
      try {
        const reloadedHtml = reloaded.getHTML();
        expect(reloadedHtml).toContain('data-src="/media/b.jpg"');
        expect(reloadedHtml).toContain('data-src="/media/c.jpg"');
        expect(reloadedHtml).not.toContain('data-src="/media/a.jpg"');
      } finally {
        reloaded.destroy();
      }
    } finally {
      editor.destroy();
    }
  });
});
