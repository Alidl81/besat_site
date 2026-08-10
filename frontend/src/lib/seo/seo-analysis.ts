import type { JSONContent } from "@tiptap/core";
import type { EditorOutlineItem } from "@/components/editor/rich-editor";

export type SeoCheckStatus = "good" | "improvement" | "problem";

export type SeoCheck = {
  id: string;
  status: SeoCheckStatus;
  title: string;
  description: string;
};

export type SeoAnalysisInput = {
  title: string;
  slug: string;
  seoTitle: string;
  metaDescription: string;
  focusKeyphrase: string;
  bodyJson: JSONContent | null;
  outline: EditorOutlineItem[];
  wordCount: number;
};

const SEO_TITLE_MIN = 40;
const SEO_TITLE_MAX = 60;
const META_DESCRIPTION_MIN = 120;
const META_DESCRIPTION_MAX = 156;
const MIN_CONTENT_WORDS = 300;
const MAX_SENTENCE_WORDS = 25;

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function includesKeyphrase(haystack: string, keyphrase: string) {
  if (!keyphrase) return false;
  return normalize(haystack).toLowerCase().includes(normalize(keyphrase).toLowerCase());
}

/** Slugs use hyphens where the keyphrase uses spaces, so a plain substring
 * check would fail even for a slug that genuinely contains every keyphrase
 * word (e.g. keyphrase "جشن بعثت" vs slug "جشن-بعثت-مدرسه"). */
function includesKeyphraseInSlug(slug: string, keyphrase: string) {
  if (!keyphrase) return false;
  const normalizedSlug = normalize(slug.replace(/[-_]+/g, " ")).toLowerCase();
  return normalizedSlug.includes(normalize(keyphrase).toLowerCase());
}

function check(
  id: string,
  status: SeoCheckStatus,
  title: string,
  description: string,
): SeoCheck {
  return { id, status, title, description };
}

/** Walks the TipTap document collecting plain text, image alt-text
 * coverage, and link-mark presence — the raw signal the checks below need
 * that isn't already exposed by the editor's outline/stats props. */
function walkDocument(node: JSONContent | null | undefined, acc: {
  text: string[];
  images: Array<{ alt?: string | null }>;
  hasLink: boolean;
}) {
  if (!node) return;

  if (node.type === "text" && typeof node.text === "string") {
    acc.text.push(node.text);
    if (node.marks?.some((mark) => mark.type === "link")) {
      acc.hasLink = true;
    }
  }

  if (node.type === "image") {
    acc.images.push({ alt: (node.attrs?.alt as string | undefined) ?? null });
  }

  if (node.type === "besatMediaBlock") {
    acc.images.push({ alt: (node.attrs?.alt as string | undefined) ?? null });
  }

  if (node.type === "besatGalleryBlock") {
    const rawItems = node.attrs?.items;
    try {
      const items = typeof rawItems === "string" ? JSON.parse(rawItems) : rawItems;
      if (Array.isArray(items)) {
        for (const item of items) {
          acc.images.push({ alt: typeof item?.alt === "string" ? item.alt : null });
        }
      }
    } catch {
      // Malformed gallery attrs shouldn't crash SEO analysis.
    }
  }

  for (const child of node.content ?? []) {
    walkDocument(child, acc);
  }
}

function extractDocumentSignals(bodyJson: JSONContent | null) {
  const acc = { text: [] as string[], images: [] as Array<{ alt?: string | null }>, hasLink: false };
  walkDocument(bodyJson, acc);
  return { plainText: acc.text.join(" "), images: acc.images, hasLink: acc.hasLink };
}

/** Splits on Persian/Latin sentence terminators for a rough readability
 * pass — not a full NLP sentence splitter, just enough to flag runs of
 * text that are clearly too dense to read comfortably. */
function splitSentences(text: string) {
  return normalize(text)
    .split(/[.!?؟۔]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function analyzeContentSeo(input: SeoAnalysisInput): SeoCheck[] {
  const checks: SeoCheck[] = [];
  const { plainText, images, hasLink } = extractDocumentSignals(input.bodyJson);
  const effectiveSeoTitle = normalize(input.seoTitle || input.title);
  const keyphrase = normalize(input.focusKeyphrase);

  // Focus keyphrase presence — every keyphrase-dependent check below is
  // only meaningful once one is set, so it's reported first.
  if (!keyphrase) {
    checks.push(
      check(
        "keyphrase-set",
        "problem",
        "عبارت کلیدی کانونی",
        "برای دریافت تحلیل سئو، ابتدا یک عبارت کلیدی کانونی برای این محتوا مشخص کنید.",
      ),
    );
  } else {
    checks.push(
      check(
        "keyphrase-set",
        "good",
        "عبارت کلیدی کانونی",
        `عبارت کلیدی «${keyphrase}» برای این محتوا تنظیم شده است.`,
      ),
    );

    checks.push(
      includesKeyphrase(effectiveSeoTitle, keyphrase)
        ? check("keyphrase-in-title", "good", "عبارت کلیدی در عنوان سئو", "عبارت کلیدی کانونی در عنوان سئو دیده می‌شود.")
        : check("keyphrase-in-title", "problem", "عبارت کلیدی در عنوان سئو", "عبارت کلیدی کانونی در عنوان سئو وجود ندارد."),
    );

    checks.push(
      includesKeyphraseInSlug(input.slug, keyphrase)
        ? check("keyphrase-in-slug", "good", "عبارت کلیدی در اسلاگ", "عبارت کلیدی کانونی در نشانی صفحه دیده می‌شود.")
        : check("keyphrase-in-slug", "improvement", "عبارت کلیدی در اسلاگ", "عبارت کلیدی کانونی در نشانی صفحه دیده نمی‌شود."),
    );

    checks.push(
      includesKeyphrase(input.metaDescription, keyphrase)
        ? check("keyphrase-in-meta", "good", "عبارت کلیدی در توضیحات متا", "عبارت کلیدی کانونی در توضیحات متا دیده می‌شود.")
        : check("keyphrase-in-meta", "improvement", "عبارت کلیدی در توضیحات متا", "عبارت کلیدی کانونی در توضیحات متا دیده نمی‌شود."),
    );

    const firstParagraph = normalize(plainText).slice(0, 300);
    checks.push(
      includesKeyphrase(firstParagraph, keyphrase)
        ? check("keyphrase-in-intro", "good", "عبارت کلیدی در ابتدای متن", "عبارت کلیدی کانونی در بخش ابتدایی محتوا دیده می‌شود.")
        : check("keyphrase-in-intro", "improvement", "عبارت کلیدی در ابتدای متن", "عبارت کلیدی کانونی را در پاراگراف نخست نیز بیاورید."),
    );

    const headingHasKeyphrase = input.outline.some((item) => includesKeyphrase(item.label, keyphrase));
    checks.push(
      input.outline.length === 0
        ? check("keyphrase-in-heading", "improvement", "عبارت کلیدی در تیترها", "این محتوا هیچ تیتر فرعی ندارد.")
        : headingHasKeyphrase
        ? check("keyphrase-in-heading", "good", "عبارت کلیدی در تیترها", "دست‌کم یکی از تیترهای محتوا شامل عبارت کلیدی است.")
        : check("keyphrase-in-heading", "improvement", "عبارت کلیدی در تیترها", "عبارت کلیدی کانونی در هیچ‌کدام از تیترها دیده نمی‌شود."),
    );

    const words = normalize(plainText).split(" ").filter(Boolean);
    const keyphraseWords = keyphrase.toLowerCase().split(" ").filter(Boolean);
    const occurrences = keyphraseWords.length
      ? Math.floor(
          (normalize(plainText).toLowerCase().split(keyphrase.toLowerCase()).length - 1),
        )
      : 0;
    const density = words.length ? (occurrences * keyphraseWords.length * 100) / words.length : 0;
    checks.push(
      occurrences === 0
        ? check("keyphrase-density", "problem", "تراکم عبارت کلیدی", "عبارت کلیدی کانونی در متن اصلی محتوا دیده نمی‌شود.")
        : density > 3
        ? check("keyphrase-density", "improvement", "تراکم عبارت کلیدی", "تراکم عبارت کلیدی نسبت به حجم متن زیاد است؛ از تکرار بیش‌ازحد بپرهیزید.")
        : check("keyphrase-density", "good", "تراکم عبارت کلیدی", `عبارت کلیدی ${occurrences} بار در متن دیده می‌شود که تراکم مناسبی دارد.`),
    );
  }

  // Title / meta description length — meaningful with or without a
  // keyphrase set.
  const titleLength = effectiveSeoTitle.length;
  checks.push(
    titleLength === 0
      ? check("title-length", "problem", "طول عنوان سئو", "عنوان سئو خالی است.")
      : titleLength < SEO_TITLE_MIN
      ? check("title-length", "improvement", "طول عنوان سئو", `عنوان سئو ${titleLength} نویسه دارد؛ عنوان کمی کوتاه است (پیشنهاد: ${SEO_TITLE_MIN} تا ${SEO_TITLE_MAX} نویسه).`)
      : titleLength > SEO_TITLE_MAX
      ? check("title-length", "improvement", "طول عنوان سئو", `عنوان سئو ${titleLength} نویسه دارد؛ ممکن است در نتایج جستجو بریده شود (پیشنهاد: حداکثر ${SEO_TITLE_MAX} نویسه).`)
      : check("title-length", "good", "طول عنوان سئو", `طول عنوان سئو (${titleLength} نویسه) مناسب است.`),
  );

  const metaLength = normalize(input.metaDescription).length;
  checks.push(
    metaLength === 0
      ? check("meta-length", "problem", "طول توضیحات متا", "توضیحات متا خالی است.")
      : metaLength < META_DESCRIPTION_MIN
      ? check("meta-length", "improvement", "طول توضیحات متا", `توضیحات متا ${metaLength} نویسه دارد؛ کمی کوتاه است (پیشنهاد: ${META_DESCRIPTION_MIN} تا ${META_DESCRIPTION_MAX} نویسه).`)
      : metaLength > META_DESCRIPTION_MAX
      ? check("meta-length", "improvement", "طول توضیحات متا", `توضیحات متا ${metaLength} نویسه دارد؛ ممکن است در نتایج جستجو بریده شود (پیشنهاد: حداکثر ${META_DESCRIPTION_MAX} نویسه).`)
      : check("meta-length", "good", "طول توضیحات متا", `طول توضیحات متا (${metaLength} نویسه) مناسب است.`),
  );

  // Content depth.
  checks.push(
    input.wordCount >= MIN_CONTENT_WORDS
      ? check("content-length", "good", "حجم محتوا", `محتوا ${input.wordCount} واژه دارد که برای سئو کافی است.`)
      : check("content-length", "improvement", "حجم محتوا", `محتوا ${input.wordCount} واژه دارد؛ محتوای طولانی‌تر (حداقل ${MIN_CONTENT_WORDS} واژه) معمولاً در نتایج جستجو عملکرد بهتری دارد.`),
  );

  // Images / alt text.
  const imagesWithoutAlt = images.filter((image) => !image.alt || !normalize(image.alt));
  checks.push(
    images.length === 0
      ? check("image-alt", "improvement", "تصاویر و متن جایگزین", "این محتوا هیچ تصویری ندارد.")
      : imagesWithoutAlt.length > 0
      ? check("image-alt", "problem", "تصاویر و متن جایگزین", `${imagesWithoutAlt.length} از ${images.length} تصویر فاقد متن جایگزین (alt) هستند.`)
      : check("image-alt", "good", "تصاویر و متن جایگزین", `همه تصاویر (${images.length} مورد) متن جایگزین دارند.`),
  );

  // Links.
  checks.push(
    hasLink
      ? check("links", "good", "پیوندها", "محتوا شامل دست‌کم یک پیوند است.")
      : check("links", "improvement", "پیوندها", "محتوا هیچ پیوندی (داخلی یا خارجی) ندارد."),
  );

  // Canonical URL well-formedness is handled by the caller (it has direct
  // field access); readability is computed here since it only needs the
  // plain text already extracted above.
  const sentences = splitSentences(plainText);
  const longSentences = sentences.filter(
    (sentence) => sentence.split(" ").filter(Boolean).length > MAX_SENTENCE_WORDS,
  );
  checks.push(
    sentences.length === 0
      ? check("readability", "improvement", "خوانایی متن", "متنی برای بررسی خوانایی وجود ندارد.")
      : longSentences.length / sentences.length > 0.25
      ? check(
          "readability",
          "improvement",
          "خوانایی متن",
          `${longSentences.length} از ${sentences.length} جمله طولانی هستند (بیش از ${MAX_SENTENCE_WORDS} واژه). جملات کوتاه‌تر خوانایی را بهتر می‌کند.`,
        )
      : check("readability", "good", "خوانایی متن", "طول جملات متن در سطح مناسبی است."),
  );

  return checks;
}

export function seoCheckSummary(checks: SeoCheck[]) {
  return {
    good: checks.filter((item) => item.status === "good").length,
    improvement: checks.filter((item) => item.status === "improvement").length,
    problem: checks.filter((item) => item.status === "problem").length,
  };
}
