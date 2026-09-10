// Shared core check for "is this string safe to treat as a same-origin
// relative/local path" -- used anywhere a leading "/" alone isn't
// sufficient proof a value can't resolve off-origin once a browser (or
// another URL parser) gets hold of it. A bare `value.startsWith("/")`
// check also accepts "//evil.example/..." (a protocol-relative URL that
// resolves against "evil.example", not this site) and "/\\evil.example"
// (which the WHATWG URL algorithm browsers use normalizes a leading
// backslash into a second forward slash for "special" schemes like https,
// reproducing the same attack after the fact).
//
// This layers two checks: a cheap string-level rejection of the known
// dangerous prefixes/characters, plus an authoritative check that resolves
// the candidate against a fixed, non-real base origin and confirms the
// parsed result still resolves to that exact origin. The second check is
// what actually catches parser-normalization tricks (e.g. a stripped
// control character collapsing "/\t/evil.example" into "//evil.example")
// that the string-level check alone cannot enumerate by hand.
//
// Used by both an auth redirect's `next` param (FE-AUTH-OPEN-REDIRECT-001)
// and untrusted rich-content media URLs (FE-RICH-MEDIA-PROTOCOL-RELATIVE-001)
// -- two different domains that happen to need the identical guarantee, so
// this fix (and any future one) only has to be made once.
const SAFE_RESOLUTION_BASE = "https://besat-internal-url-safety-check.invalid";

export function isSafeRelativePath(value: string): boolean {
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//") || value.startsWith("/\\") || value.includes("\\")) return false;
  try {
    return new URL(value, SAFE_RESOLUTION_BASE).origin === SAFE_RESOLUTION_BASE;
  } catch {
    return false;
  }
}

// FE-SHOP-COURSE-ACCESS-URL-001: for a destination that's *supposed* to be
// an arbitrary external link (a course's Zoom/webinar/access URL, backend-
// free-text, no schema validation upstream), isSafeRelativePath() is the
// wrong tool -- it only ever accepts same-origin relative paths. What this
// needs instead is "is this a genuine, navigable http(s) URL," rejecting
// active-document/script-executing schemes (`javascript:`, `vbscript:`),
// non-web schemes (`data:`, `file:`), and anything that isn't a fully
// qualified absolute URL to begin with (a bare `new URL(value)` call with
// no base throws for a protocol-relative "//evil.example" or a plain
// relative path, since neither carries a scheme of its own -- verified
// empirically rather than assumed).
export function isSafeExternalHttpUrl(value: string): boolean {
  // SEC-FE-MEDIA-PICKER-URL-001 (adjacent hardening): a backslash, or an
  // ASCII tab/newline/CR (which the WHATWG URL parser silently strips
  // before resolving), can make an absolute-looking URL string parse to
  // something different from what its raw characters show -- e.g.
  // "http:\\evil.example" parses identically to "http://evil.example".
  // Reject any input that needs that kind of normalization up front
  // instead of accepting whatever `new URL()` creatively resolves it to.
  if (/[\\\t\n\r]/.test(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
