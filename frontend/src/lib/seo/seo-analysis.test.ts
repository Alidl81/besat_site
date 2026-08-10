import { describe, expect, it } from "vitest";
import { analyzeContentSeo, seoCheckSummary } from "@/lib/seo/seo-analysis";

function statusOf(checks: ReturnType<typeof analyzeContentSeo>, id: string) {
  return checks.find((check) => check.id === id)?.status;
}

describe("analyzeContentSeo", () => {
  it("reports a problem when no focus keyphrase is set", () => {
    const checks = analyzeContentSeo({
      title: "خبر نمونه",
      slug: "khabar-nemooneh",
      seoTitle: "",
      metaDescription: "",
      focusKeyphrase: "",
      bodyJson: null,
      outline: [],
      wordCount: 0,
    });

    expect(statusOf(checks, "keyphrase-set")).toBe("problem");
  });

  it("recognizes the keyphrase across title, slug, meta description and intro", () => {
    const checks = analyzeContentSeo({
      title: "جشن بعثت در مدرسه",
      slug: "جشن-بعثت-در-مدرسه",
      seoTitle: "جشن بعثت در مدرسه بعثت",
      metaDescription: "گزارشی از برگزاری جشن بعثت در مجتمع آموزشی.",
      focusKeyphrase: "جشن بعثت",
      bodyJson: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "جشن بعثت با حضور دانش‌آموزان برگزار شد." }],
          },
        ],
      },
      outline: [],
      wordCount: 8,
    });

    expect(statusOf(checks, "keyphrase-in-title")).toBe("good");
    expect(statusOf(checks, "keyphrase-in-slug")).toBe("good");
    expect(statusOf(checks, "keyphrase-in-meta")).toBe("good");
    expect(statusOf(checks, "keyphrase-in-intro")).toBe("good");
  });

  it("flags a heading match only when a heading actually contains the keyphrase", () => {
    const withMatch = analyzeContentSeo({
      title: "t",
      slug: "s",
      seoTitle: "t",
      metaDescription: "d",
      focusKeyphrase: "بعثت",
      bodyJson: null,
      outline: [{ index: 0, type: "heading2", label: "درباره بعثت" }],
      wordCount: 10,
    });
    expect(statusOf(withMatch, "keyphrase-in-heading")).toBe("good");

    const withoutMatch = analyzeContentSeo({
      title: "t",
      slug: "s",
      seoTitle: "t",
      metaDescription: "d",
      focusKeyphrase: "بعثت",
      bodyJson: null,
      outline: [{ index: 0, type: "heading2", label: "گزارش هفتگی" }],
      wordCount: 10,
    });
    expect(statusOf(withoutMatch, "keyphrase-in-heading")).toBe("improvement");
  });

  it("flags images missing alt text across image, media block, and gallery nodes", () => {
    const checks = analyzeContentSeo({
      title: "t",
      slug: "s",
      seoTitle: "t",
      metaDescription: "d",
      focusKeyphrase: "",
      bodyJson: {
        type: "doc",
        content: [
          { type: "image", attrs: { alt: "" } },
          { type: "besatMediaBlock", attrs: { alt: "تصویر معتبر" } },
          {
            type: "besatGalleryBlock",
            attrs: { items: JSON.stringify([{ src: "a.jpg", alt: "" }, { src: "b.jpg", alt: "آلبوم" }]) },
          },
        ],
      },
      outline: [],
      wordCount: 0,
    });

    const imageCheck = checks.find((check) => check.id === "image-alt");
    expect(imageCheck?.status).toBe("problem");
    expect(imageCheck?.description).toContain("2");
    expect(imageCheck?.description).toContain("4");
  });

  it("reports good image-alt status when every image has alt text", () => {
    const checks = analyzeContentSeo({
      title: "t",
      slug: "s",
      seoTitle: "t",
      metaDescription: "d",
      focusKeyphrase: "",
      bodyJson: {
        type: "doc",
        content: [{ type: "image", attrs: { alt: "توضیح تصویر" } }],
      },
      outline: [],
      wordCount: 0,
    });

    expect(statusOf(checks, "image-alt")).toBe("good");
  });

  it("detects links via the link mark", () => {
    const withLink = analyzeContentSeo({
      title: "t",
      slug: "s",
      seoTitle: "t",
      metaDescription: "d",
      focusKeyphrase: "",
      bodyJson: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "مشاهده", marks: [{ type: "link", attrs: { href: "/news" } }] },
            ],
          },
        ],
      },
      outline: [],
      wordCount: 1,
    });
    expect(statusOf(withLink, "links")).toBe("good");

    const withoutLink = analyzeContentSeo({
      title: "t",
      slug: "s",
      seoTitle: "t",
      metaDescription: "d",
      focusKeyphrase: "",
      bodyJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "متن" }] }] },
      outline: [],
      wordCount: 1,
    });
    expect(statusOf(withoutLink, "links")).toBe("improvement");
  });

  it("scores title and meta-description length against Yoast-style ranges", () => {
    const tooShort = analyzeContentSeo({
      title: "کوتاه",
      slug: "s",
      seoTitle: "کوتاه",
      metaDescription: "خلاصه کوتاه",
      focusKeyphrase: "",
      bodyJson: null,
      outline: [],
      wordCount: 0,
    });
    expect(statusOf(tooShort, "title-length")).toBe("improvement");
    expect(statusOf(tooShort, "meta-length")).toBe("improvement");

    const goodLength = analyzeContentSeo({
      title: "x",
      slug: "s",
      seoTitle: "این یک عنوان سئوی نمونه با طول مناسب برای آزمایش است",
      metaDescription:
        "این یک توضیح متای نمونه با طول مناسب است که برای آزمایش نوشته شده و باید بین محدوده پیشنهادی طول توضیحات متا برای موتورهای جستجو قرار بگیرد و کافی باشد.",
      focusKeyphrase: "",
      bodyJson: null,
      outline: [],
      wordCount: 0,
    });
    expect(statusOf(goodLength, "title-length")).toBe("good");
    expect(statusOf(goodLength, "meta-length")).toBe("good");
  });

  it("flags thin content and rewards sufficient word count", () => {
    const thin = analyzeContentSeo({
      title: "t",
      slug: "s",
      seoTitle: "t",
      metaDescription: "d",
      focusKeyphrase: "",
      bodyJson: null,
      outline: [],
      wordCount: 40,
    });
    expect(statusOf(thin, "content-length")).toBe("improvement");

    const sufficient = analyzeContentSeo({
      title: "t",
      slug: "s",
      seoTitle: "t",
      metaDescription: "d",
      focusKeyphrase: "",
      bodyJson: null,
      outline: [],
      wordCount: 400,
    });
    expect(statusOf(sufficient, "content-length")).toBe("good");
  });

  it("summarizes checks by status", () => {
    const checks = analyzeContentSeo({
      title: "t",
      slug: "s",
      seoTitle: "t",
      metaDescription: "d",
      focusKeyphrase: "",
      bodyJson: null,
      outline: [],
      wordCount: 400,
    });
    const summary = seoCheckSummary(checks);
    expect(summary.good + summary.improvement + summary.problem).toBe(checks.length);
  });
});
