import { describe, expect, it } from "vitest";
import { sanitizeCmsHtml } from "@/lib/content/sanitize-cms-html";
import {
  buildCalloutBlockHtml,
  buildEmbedBlockHtml,
  buildGalleryBlockHtml,
  buildMediaBlockHtml,
  buildQuoteBlockHtml,
  normalizeSafeEmbedUrl,
} from "@/lib/editor/structured-content";

describe("structured CMS blocks", () => {
  it("keeps media, gallery captions and credits through sanitization", () => {
    const gallery = buildGalleryBlockHtml([
      {
        id: "media-7",
        src: "/media/gallery.jpg",
        type: "image",
        alt: "حیاط مدرسه",
        caption: "جشن آغاز سال",
        credit: "روابط عمومی",
      },
      {
        src: "https://cdn.example.test/clip.mp4",
        type: "video",
        title: "گزارش تصویری",
        caption: "ویدئوی مراسم",
      },
    ]);
    const media = buildMediaBlockHtml({
      src: "/media/feature.jpg",
      type: "image",
      alt: "تصویر شاخص",
      caption: "توضیح تصویر",
      credit: "عکاس مدرسه",
      width: "720px",
    });
    const clean = sanitizeCmsHtml(gallery + media);

    expect(clean).toContain('data-besat-block="gallery"');
    expect(clean).toContain('data-alt="حیاط مدرسه"');
    expect(clean).toContain('data-caption="جشن آغاز سال"');
    expect(clean).toContain('data-credit="روابط عمومی"');
    expect(clean).toContain('data-besat-block="media"');
    expect(clean).toContain("<figcaption>توضیح تصویر</figcaption>");
    expect(clean).toContain("<cite>عکاس مدرسه</cite>");
  });

  it("retains quote, callout, table alignment and safe embeds", () => {
    const quote = buildQuoteBlockHtml("متن نقل‌قول", "نام منبع");
    const callout = buildCalloutBlockHtml("یادآوری", "متن برجسته", "تحریریه", "warning");
    const embed = buildEmbedBlockHtml(
      "https://youtu.be/abcDEF123",
      "ویدئوی مراسم",
      "زیرنویس ویدئو",
    );
    const table = '<table><colgroup><col style="width: 42%"></colgroup><tbody><tr><td style="text-align: right">متن جدول</td></tr></tbody></table>';
    const clean = sanitizeCmsHtml(quote + callout + embed + table);

    expect(clean).toContain('data-besat-block="quote"');
    expect(clean).toContain('data-besat-block="callout"');
    expect(clean).toContain('data-tone="warning"');
    expect(clean).toContain("youtube-nocookie.com/embed/abcDEF123");
    expect(clean).toContain("<colgroup>");
    expect(clean).toContain("text-align: right");
  });

  it("rejects unsafe media and unsupported embeds", () => {
    expect(normalizeSafeEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeSafeEmbedUrl("https://example.test/video")).toBeNull();
    expect(buildEmbedBlockHtml("https://example.test/video", "x")).toBe("");

    const clean = sanitizeCmsHtml(
      '<figure data-besat-block="embed" data-src="https://example.test/video"><iframe src="https://example.test/video"></iframe></figure><img src="javascript:alert(1)">',
    );
    expect(clean).not.toContain("<iframe");
    expect(clean).not.toContain("javascript:");
  });
});
