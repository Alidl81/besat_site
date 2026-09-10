// JSON.stringify never escapes "<", so a CMS-controlled string field (e.g.
// a product title/description) containing the literal text "</script>"
// would close an embedding <script type="application/ld+json"> tag early
// in the HTML parser -- which runs BEFORE any JSON/JS parsing -- letting
// whatever HTML follows in that field execute on the page. Escaping "<" as
// its JSON/JS-safe unicode equivalent (still valid, semantically identical
// JSON once parsed) makes that sequence unable to ever appear literally in
// the emitted markup.
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
