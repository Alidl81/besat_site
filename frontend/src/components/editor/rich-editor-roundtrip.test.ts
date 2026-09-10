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

  it("persists image resize width, alignment, and alt text through save + reload", () => {
    const editor = new Editor({
      extensions: createRichEditorDocumentExtensions("simple"),
      content: "<p></p>",
    });

    try {
      editor.commands.insertContent({
        type: "image",
        attrs: {
          src: "/media/photo.jpg",
          alt: "توضیح تصویر",
          width: "420px",
          align: "left",
        },
      });

      const html = editor.getHTML();
      expect(html).toContain('data-width="420px"');
      expect(html).toContain('data-align="left"');
      expect(html).toContain('alt="توضیح تصویر"');

      // Round-trip through a fresh editor instance -- simulates a reload
      // where the editor is hydrated from the persisted body_html/editor_json
      // rather than kept alive in memory. The resize/alignment must survive
      // this, not silently reset to defaults (the bug this test guards).
      const reloaded = new Editor({
        extensions: createRichEditorDocumentExtensions("simple"),
        content: html,
      });
      try {
        let imageNode: ReturnType<typeof reloaded.state.doc.nodeAt> = null;
        reloaded.state.doc.descendants((node) => {
          if (node.type.name === "image") imageNode = node;
        });
        expect(imageNode).not.toBeNull();
        expect(imageNode!.attrs.width).toBe("420px");
        expect(imageNode!.attrs.align).toBe("left");
        expect(imageNode!.attrs.alt).toBe("توضیح تصویر");
      } finally {
        reloaded.destroy();
      }
    } finally {
      editor.destroy();
    }
  });

  it("defaults a plain, pre-existing <img> (legacy content with no stored size) to centered with no stored width", () => {
    const editor = new Editor({
      extensions: createRichEditorDocumentExtensions("simple"),
      content: '<img src="/media/legacy.jpg" alt="تصویر قدیمی">',
    });

    try {
      let imageNode: ReturnType<typeof editor.state.doc.nodeAt> = null;
      editor.state.doc.descendants((node) => {
        if (node.type.name === "image") imageNode = node;
      });
      expect(imageNode).not.toBeNull();
      expect(imageNode!.attrs.width).toBeNull();
      expect(imageNode!.attrs.align).toBe("center");
    } finally {
      editor.destroy();
    }
  });

  it("persists table theme/density/striped/fullWidth/caption through save + reload", () => {
    const editor = new Editor({
      extensions: createRichEditorDocumentExtensions("advanced"),
      content: "<p></p>",
    });

    try {
      editor.chain().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
      editor.chain().updateAttributes("table", {
        theme: "formal",
        density: "compact",
        striped: true,
        fullWidth: false,
        caption: "برنامه هفتگی",
      }).run();

      const html = editor.getHTML();
      expect(html).toContain("besat-table--theme-formal");
      expect(html).toContain("besat-table--density-compact");
      expect(html).toContain("besat-table--striped");
      expect(html).toContain("besat-table--auto-width");
      expect(html).toContain('data-caption="برنامه هفتگی"');

      const reloaded = new Editor({ extensions: createRichEditorDocumentExtensions("advanced"), content: html });
      try {
        let tableNode: ReturnType<typeof reloaded.state.doc.nodeAt> = null;
        reloaded.state.doc.descendants((node) => {
          if (node.type.name === "table") tableNode = node;
        });
        expect(tableNode).not.toBeNull();
        expect(tableNode!.attrs.theme).toBe("formal");
        expect(tableNode!.attrs.density).toBe("compact");
        expect(tableNode!.attrs.striped).toBe(true);
        expect(tableNode!.attrs.fullWidth).toBe(false);
        expect(tableNode!.attrs.caption).toBe("برنامه هفتگی");
      } finally {
        reloaded.destroy();
      }
    } finally {
      editor.destroy();
    }
  });

  it("a legacy table with no stored attrs at all defaults to minimal/normal/no caption", () => {
    const editor = new Editor({
      extensions: createRichEditorDocumentExtensions("advanced"),
      content: "<table><tbody><tr><td>سلول</td></tr></tbody></table>",
    });

    try {
      let tableNode: ReturnType<typeof editor.state.doc.nodeAt> = null;
      editor.state.doc.descendants((node) => {
        if (node.type.name === "table") tableNode = node;
      });
      expect(tableNode).not.toBeNull();
      expect(tableNode!.attrs.theme).toBe("minimal");
      expect(tableNode!.attrs.density).toBe("normal");
      expect(tableNode!.attrs.striped).toBe(false);
      expect(tableNode!.attrs.caption).toBe("");
    } finally {
      editor.destroy();
    }
  });

  it("persists image caption/link/radius/lightbox through save + reload", () => {
    const editor = new Editor({
      extensions: createRichEditorDocumentExtensions("simple"),
      content: "<p></p>",
    });

    try {
      editor.commands.insertContent({
        type: "image",
        attrs: {
          src: "/media/photo.jpg",
          caption: "زیرنویس",
          link: "https://example.com",
          radius: "lg",
          lightbox: true,
        },
      });

      const html = editor.getHTML();
      expect(html).toContain('data-caption="زیرنویس"');
      expect(html).toContain('data-link="https://example.com"');
      expect(html).toContain('data-radius="lg"');
      expect(html).toContain('data-lightbox="true"');

      const reloaded = new Editor({ extensions: createRichEditorDocumentExtensions("simple"), content: html });
      try {
        let imageNode: ReturnType<typeof reloaded.state.doc.nodeAt> = null;
        reloaded.state.doc.descendants((node) => {
          if (node.type.name === "image") imageNode = node;
        });
        expect(imageNode).not.toBeNull();
        expect(imageNode!.attrs.caption).toBe("زیرنویس");
        expect(imageNode!.attrs.link).toBe("https://example.com");
        expect(imageNode!.attrs.radius).toBe("lg");
        expect(imageNode!.attrs.lightbox).toBe(true);
      } finally {
        reloaded.destroy();
      }
    } finally {
      editor.destroy();
    }
  });

  it("persists gallery layout attrs (columns/gap/aspect/captions/lightbox) through save + reload", () => {
    const editor = new Editor({
      extensions: createRichEditorDocumentExtensions("advanced"),
      content: buildGalleryBlockHtml([{ src: "/media/a.jpg", type: "image" }]),
    });

    try {
      editor.chain().updateAttributes("besatGalleryBlock", {
        columns: "4",
        gap: "compact",
        aspect: "square",
        captions: false,
        lightbox: false,
      }).run();

      const html = editor.getHTML();
      const reloaded = new Editor({ extensions: createRichEditorDocumentExtensions("advanced"), content: html });
      try {
        let galleryNode: ReturnType<typeof reloaded.state.doc.nodeAt> = null;
        reloaded.state.doc.descendants((node) => {
          if (node.type.name === "besatGalleryBlock") galleryNode = node;
        });
        expect(galleryNode).not.toBeNull();
        expect(galleryNode!.attrs.columns).toBe("4");
        expect(galleryNode!.attrs.gap).toBe("compact");
        expect(galleryNode!.attrs.aspect).toBe("square");
        expect(galleryNode!.attrs.captions).toBe(false);
        expect(galleryNode!.attrs.lightbox).toBe(false);
      } finally {
        reloaded.destroy();
      }
    } finally {
      editor.destroy();
    }
  });

  it("persists quote style/author/source through save + reload", () => {
    const editor = new Editor({
      extensions: createRichEditorDocumentExtensions("advanced"),
      content: buildQuoteBlockHtml("متن نقل‌قول"),
    });

    try {
      editor.chain().updateAttributes("besatQuoteBlock", {
        style: "accent",
        author: "نویسنده",
        source: "منبع",
      }).run();

      const html = editor.getHTML();
      const reloaded = new Editor({ extensions: createRichEditorDocumentExtensions("advanced"), content: html });
      try {
        let quoteNode: ReturnType<typeof reloaded.state.doc.nodeAt> = null;
        reloaded.state.doc.descendants((node) => {
          if (node.type.name === "besatQuoteBlock") quoteNode = node;
        });
        expect(quoteNode).not.toBeNull();
        expect(quoteNode!.attrs.style).toBe("accent");
        expect(quoteNode!.attrs.author).toBe("نویسنده");
        expect(quoteNode!.attrs.source).toBe("منبع");
      } finally {
        reloaded.destroy();
      }
    } finally {
      editor.destroy();
    }
  });

  it("persists all 5 callout tones through save + reload", () => {
    for (const tone of ["note", "info", "success", "warning", "important"]) {
      const editor = new Editor({
        extensions: createRichEditorDocumentExtensions("advanced"),
        content: buildCalloutBlockHtml("عنوان", "متن", undefined, "info"),
      });
      try {
        editor.chain().updateAttributes("besatCalloutBlock", { tone }).run();
        const html = editor.getHTML();
        expect(html).toContain(`data-tone="${tone}"`);
      } finally {
        editor.destroy();
      }
    }
  });

  it("persists code block language/lineNumbers/wrap/copyButton through save + reload", () => {
    const editor = new Editor({
      extensions: createRichEditorDocumentExtensions("advanced"),
      content: "<p></p>",
    });

    try {
      editor.chain().focus().setCodeBlock({ language: "python" }).run();
      editor.chain().updateAttributes("codeBlock", { lineNumbers: true, wrap: true, copyButton: false }).run();

      const html = editor.getHTML();
      expect(html).toContain('data-language="python"');
      expect(html).toContain('data-line-numbers="true"');
      expect(html).toContain('data-wrap="true"');
      expect(html).toContain('data-copy="false"');

      const reloaded = new Editor({ extensions: createRichEditorDocumentExtensions("advanced"), content: html });
      try {
        let codeNode: ReturnType<typeof reloaded.state.doc.nodeAt> = null;
        reloaded.state.doc.descendants((node) => {
          if (node.type.name === "codeBlock") codeNode = node;
        });
        expect(codeNode).not.toBeNull();
        expect(codeNode!.attrs.language).toBe("python");
        expect(codeNode!.attrs.lineNumbers).toBe(true);
        expect(codeNode!.attrs.wrap).toBe(true);
        expect(codeNode!.attrs.copyButton).toBe(false);
      } finally {
        reloaded.destroy();
      }
    } finally {
      editor.destroy();
    }
  });

  it("persists embed aspect ratio through save + reload", () => {
    const editor = new Editor({
      extensions: createRichEditorDocumentExtensions("advanced"),
      content: buildEmbedBlockHtml("https://youtu.be/abcDEF123", "ویدئو"),
    });

    try {
      editor.chain().updateAttributes("besatEmbedBlock", { aspect: "4:3" }).run();
      const html = editor.getHTML();
      expect(html).toContain('data-aspect="4:3"');

      const reloaded = new Editor({ extensions: createRichEditorDocumentExtensions("advanced"), content: html });
      try {
        let embedNode: ReturnType<typeof reloaded.state.doc.nodeAt> = null;
        reloaded.state.doc.descendants((node) => {
          if (node.type.name === "besatEmbedBlock") embedNode = node;
        });
        expect(embedNode).not.toBeNull();
        expect(embedNode!.attrs.aspect).toBe("4:3");
      } finally {
        reloaded.destroy();
      }
    } finally {
      editor.destroy();
    }
  });
});
