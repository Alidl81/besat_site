import DOMPurify from "isomorphic-dompurify";
import {
  normalizeSafeEmbedUrl,
  safeStructuredMediaUrl,
} from "@/lib/editor/structured-content";

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
];

const allowedStyleProperties = new Set([
  "text-align",
  "width",
  "min-width",
  "max-width",
  "height",
]);

function isSafeDimension(value: string) {
  return /^(?:0|(?:[1-9]\d*(?:\.\d+)?)(?:px|%|rem|em|vw|vh))$/.test(value);
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

  if (data.attrName === "src") {
    if (tag === "iframe") {
      data.keepAttr = normalizeSafeEmbedUrl(data.attrValue) === data.attrValue;
      return;
    }
    if (["img", "video", "source"].includes(tag)) {
      data.keepAttr = Boolean(safeStructuredMediaUrl(data.attrValue));
      return;
    }
  }

  if (data.attrName === "data-src") {
    data.keepAttr = blockType === "embed"
      ? normalizeSafeEmbedUrl(data.attrValue) === data.attrValue
      : Boolean(safeStructuredMediaUrl(data.attrValue));
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
      "src",
      "alt",
      "title",
      "width",
      "height",
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
      "data-body",
      "data-tone",
      "class",
      "dir",
    ],
    ALLOW_DATA_ATTR: false,
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allowfullscreen"],
  });
}
