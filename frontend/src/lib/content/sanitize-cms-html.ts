import DOMPurify from "isomorphic-dompurify";
import {
  normalizeSafeEmbedUrl,
  safeStructuredMediaUrl,
} from "@/lib/editor/structured-content";
import { isSafeExternalHttpUrl, isSafeRelativePath } from "@/lib/url-safety";

// SEC-FE-RICH-LINK-001: DOMPurify's own default URI sanitization (its
// ALLOWED_URI_REGEXP) only rejects script-executing schemes like
// `javascript:`/`vbscript:` -- it does not reject a protocol-relative
// `//evil.example/phish`, since that carries no scheme at all to match
// against. That's not a script-execution risk, but it IS a phishing/
// open-redirect one: a CMS-authored link that looks like a same-origin
// path silently navigates to an attacker-controlled origin instead. This
// reuses the same relative-path/external-http(s) check already applied to
// media `src`/`data-src` above (FE-RICH-MEDIA-PROTOCOL-RELATIVE-001,
// FE-SHOP-COURSE-ACCESS-URL-001) for `href`, which had no such check at all.
function isSafeLinkHref(value: string) {
  return isSafeRelativePath(value) || isSafeExternalHttpUrl(value);
}

const allowedTags = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "hr",
  "figure",
  "figcaption",
  "cite",
  "img",
  "video",
  "source",
  "iframe",
  "table",
  "caption",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "colgroup",
  "col",
  "pre",
  "code",
  "section",
  "div",
  "span",
  "sub",
  "sup",
  "mark",
  "button",
];

const allowedStyleProperties = new Set([
  "text-align",
  "width",
  "min-width",
  "max-width",
  "height",
  "margin",
  "margin-inline-start",
  "margin-inline-end",
  "display",
  "color",
  "background-color",
]);

function isSafeDimension(value: string) {
  return /^(?:0|(?:[1-9]\d*(?:\.\d+)?)(?:px|%|rem|em|vw|vh)|auto)$/.test(value);
}

// Only a plain #rrggbb hex color is accepted -- never url(), calc(),
// gradients, or CSS custom properties, which could otherwise be abused to
// load external resources or break out of the declared property.
function isSafeColor(value: string) {
  return /^#[0-9a-f]{6}$/.test(value);
}

// "margin:0 auto;" / "margin:0 auto 0 0;" -- the fixed set of alignment
// margins render_tiptap_node's image branch emits. No arbitrary margin
// values are accepted.
function isSafeMargin(value: string) {
  return /^0(?: (?:auto|0))* ?(?:auto|0)?$/.test(value.trim());
}

function sanitizeInlineStyle(value: string) {
  return value
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separator = declaration.indexOf(":");
      if (separator < 1) return null;
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const rawValue = declaration.slice(separator + 1).trim().toLowerCase();
      if (!allowedStyleProperties.has(property)) return null;
      if (property === "text-align") {
        return /^(left|right|center|justify)$/.test(rawValue)
          ? `${property}: ${rawValue}`
          : null;
      }
      if (property === "display") {
        return rawValue === "block" ? `${property}: ${rawValue}` : null;
      }
      if (property === "color" || property === "background-color") {
        return isSafeColor(rawValue) ? `${property}: ${rawValue}` : null;
      }
      if (property === "margin" || property === "margin-inline-start" || property === "margin-inline-end") {
        return isSafeMargin(rawValue) || isSafeDimension(rawValue)
          ? `${property}: ${rawValue}`
          : null;
      }
      return isSafeDimension(rawValue) ? `${property}: ${rawValue}` : null;
    })
    .filter((declaration): declaration is string => Boolean(declaration))
    .join("; ");
}

DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
  const tag = node.nodeName.toLowerCase();
  const blockType = node.getAttribute?.("data-besat-block") ?? "";

  if (data.attrName === "style") {
    const safeStyle = sanitizeInlineStyle(data.attrValue);
    data.attrValue = safeStyle;
    data.keepAttr = Boolean(safeStyle);
    return;
  }

  if (data.attrName === "href" && tag === "a") {
    data.keepAttr = isSafeLinkHref(data.attrValue);
    return;
  }

  // FE-RICH-EMBED-STANDARD-URL-COMPAT-001: normalizeSafeEmbedUrl()
  // recognizes a safe provider URL and returns its *canonical* embed form
  // (e.g. a standard "youtube.com/watch?v=..." URL normalizes to
  // "youtube-nocookie.com/embed/..."), which is not byte-identical to most
  // legitimate input. Content built by this app's own editor
  // (buildEmbedBlockHtml, structured-content.ts) already stores the
  // canonical form, so an equality check against the original input
  // happened to pass for that path -- but any other legitimately safe,
  // recognized URL (a standard watch/share URL pasted or imported from
  // elsewhere) normalized to something different, was therefore rejected
  // outright, and DOMPurify's own afterSanitizeAttributes hook below then
  // removed the whole src-less <iframe>, leaving an empty embed block.
  // Rewriting the attribute to the canonical form when it's recognized --
  // rather than only ever keeping it byte-identical -- accepts every URL
  // the host/pattern allowlist inside normalizeSafeEmbedUrl() actually
  // recognizes as safe, while still rejecting (keepAttr = false) anything
  // it doesn't.
  if (data.attrName === "src") {
    if (tag === "iframe") {
      const normalizedEmbed = normalizeSafeEmbedUrl(data.attrValue);
      data.keepAttr = normalizedEmbed !== null;
      if (normalizedEmbed !== null) data.attrValue = normalizedEmbed;
      return;
    }
    if (["img", "video", "source"].includes(tag)) {
      data.keepAttr = Boolean(safeStructuredMediaUrl(data.attrValue));
      return;
    }
  }

  if (data.attrName === "data-src") {
    if (blockType === "embed") {
      const normalizedEmbed = normalizeSafeEmbedUrl(data.attrValue);
      data.keepAttr = normalizedEmbed !== null;
      if (normalizedEmbed !== null) data.attrValue = normalizedEmbed;
    } else {
      data.keepAttr = Boolean(safeStructuredMediaUrl(data.attrValue));
    }
  }
});

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.nodeName.toLowerCase() === "iframe" && !node.getAttribute("src")) {
    node.remove();
  }
});

export function sanitizeCmsHtml(value: string) {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: [
      "href",
      "target",
      "rel",
      "src",
      "alt",
      "title",
      "width",
      "height",
      "type",
      "colspan",
      "rowspan",
      "colwidth",
      "style",
      "controls",
      "preload",
      "loading",
      "allowfullscreen",
      "referrerpolicy",
      "allow",
      "data-besat-block",
      "data-besat-gallery-item",
      "data-src",
      "data-type",
      "data-width",
      "data-height",
      "data-media",
      "data-media-type",
      "data-id",
      "data-title",
      "data-alt",
      "data-caption",
      "data-credit",
      "data-text",
      "data-cite",
      "data-author",
      "data-source",
      "data-body",
      "data-tone",
      "data-style",
      "data-align",
      "data-radius",
      "data-lightbox",
      "data-columns",
      "data-gap",
      "data-aspect",
      "data-captions",
      "data-theme",
      "data-density",
      "data-striped",
      "data-full-width",
      "data-language",
      "data-line-numbers",
      "data-wrap",
      "data-copy",
      "data-copy-code",
      "class",
      "dir",
    ],
    ALLOW_DATA_ATTR: false,
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allowfullscreen"],
  });
}
