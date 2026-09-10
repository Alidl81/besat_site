import { afterEach, describe, expect, it, vi } from "vitest";
import { sanitizeCmsHtml } from "@/lib/content/sanitize-cms-html";
import {
  buildCalloutBlockHtml,
  buildEmbedBlockHtml,
  buildGalleryBlockHtml,
  buildMediaBlockHtml,
  buildQuoteBlockHtml,
  normalizeSafeEmbedUrl,
  safeStructuredMediaUrl,
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

// SEC-FE-RICH-MEDIA-PARSER-001: safeStructuredMediaUrl's absolute-URL
// branch had the same bare-`new URL()` gap already fixed in
// isSafeExternalHttpUrl and lib/media/safe-url.ts -- a backslash-scheme
// form like "http:\evil.example/pixel.jpg" parses identically to the
// honest forward-slash form and resolves to an attacker-controlled host.
// Now delegates to the shared, hardened isSafeExternalHttpUrl(), which
// also fixes sanitizeCmsHtml's <img src> sanitization since it calls
// safeStructuredMediaUrl directly.
describe("safeStructuredMediaUrl absolute parser-normalization boundary", () => {
  it("rejects HTTP(S) values whose backslashes normalize to an external host", () => {
    const candidates = [
      "http:\\\\evil.example/pixel.jpg",
      "http:/\\/evil.example/pixel.jpg",
    ];

    for (const candidate of candidates) {
      expect(safeStructuredMediaUrl(candidate), candidate).toBeNull();
      const clean = sanitizeCmsHtml(`<img src="${candidate}">`);
      expect(clean, candidate).not.toContain("evil.example");
    }
  });

  it("still accepts a genuine absolute https media URL", () => {
    expect(safeStructuredMediaUrl("https://cdn.example.com/image.jpg")).toBe("https://cdn.example.com/image.jpg");
  });
});

// SEC-FE-RICH-MEDIA-ORIGIN-001: safeStructuredMediaUrl() now delegates
// entirely to safePublicMediaUrl() (FE-PUBLIC-MEDIA-ORIGIN-001), so a
// persisted rich-content gallery/media `src` the backend built with the
// wrong Host (e.g. absolute "http://localhost:3000/media/..." in a real
// deployment) is rewritten to this app's own origin instead of rendering
// a dead cross-origin <img> that trips the CSP img-src allowlist.
describe("safeStructuredMediaUrl media-origin normalization", () => {
  const originalLocation = window.location;

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("rewrites a wrong-origin /media/ URL to the site's own origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://besat.example.com");
    // FE-PUBLIC-MEDIA-ORIGIN-001 (reopened): safe-url.ts's effectiveSiteUrl()
    // now prefers window.location.origin over NEXT_PUBLIC_SITE_URL whenever
    // a window exists (this function is genuinely used client-side, in
    // rich-content-renderer.tsx/rich-editor.tsx) -- jsdom always provides
    // one, so this test's simulated "viewing from besat.example.com" needs
    // it stubbed to match.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, origin: "https://besat.example.com" },
    });
    expect(safeStructuredMediaUrl("http://localhost:3000/media/gallery/a.jpg")).toBe(
      "https://besat.example.com/media/gallery/a.jpg",
    );
  });

  it("does not rewrite a non-/media/ absolute URL even with a mismatched origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://besat.example.com");
    expect(safeStructuredMediaUrl("https://cdn.example.com/image.jpg")).toBe("https://cdn.example.com/image.jpg");
  });
});
