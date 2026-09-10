import { isSafeExternalHttpUrl, isSafeRelativePath } from "@/lib/url-safety";

// FE-RICH-MEDIA-PROTOCOL-RELATIVE-001 (same defect pattern, proactively
// applied here too): a bare `value.startsWith("/")` check also accepts a
// protocol-relative "//evil.example/..." unchanged, which the browser
// resolves off-origin -- this function is used across public news/gallery/
// achievements/units content rendering, the same untrusted-CMS-content
// threat model as the originally flagged safeStructuredMediaUrl().
//
// SEC-FE-PUBLIC-MEDIA-PARSER-001: the absolute-URL branch used to be a
// bare `new URL(value)` + protocol check here, which (like the pre-fix
// media-picker-dialog.tsx and lib/url-safety.ts) accepted backslash-scheme
// forms such as "http:\\evil.example/pixel.jpg" that parse identically to
// the honest "http://evil.example/pixel.jpg". Delegating to the shared,
// already-hardened `isSafeExternalHttpUrl()` (which rejects a backslash or
// ASCII tab/newline/CR up front) closes this the same way it was closed
// for the media picker and course-access-URL call sites, instead of
// re-adding a third copy of the same check here.
// FE-PUBLIC-MEDIA-ORIGIN-001: the backend's own absolute media URLs
// (product.featured_image, gallery/news/unit cover images, etc.) embed
// whatever Host it resolved the request against at write/read time, which
// is not always this app's real public origin (e.g. it can come back as
// "http://localhost:3000/..." even in a production deployment). This app's
// own "/media/:path*" is always a working way to reach the same file
// regardless of what the backend embedded: next.config.ts's rewrites()
// proxies any request to that path, on this app's own origin, straight
// through to the real backend. Rewriting the origin to match
// NEXT_PUBLIC_SITE_URL for exactly this fixed prefix (matching the
// backend's own MEDIA_URL default, backend/config/settings/base.py) turns
// a possibly-wrong absolute URL into one that both resolves correctly in
// the visitor's browser and matches next.config.ts's images.remotePatterns
// (this app's own origin only) so next/image can actually optimize it,
// instead of the previous cross-origin unoptimized fetch to a dead host
// that also tripped the CSP img-src allowlist. A genuinely external,
// admin-pasted URL outside this prefix is left untouched.
const MEDIA_PATH_PREFIX = "/media/";

// SEC-FE-RICH-MEDIA-ORIGIN-002 (backend mirror -- rich_text.py's
// _is_own_backend_host()/ALLOWED_HOSTS check found by an independent live
// probe): a path merely starting with "/media/" is not enough to decide a
// URL is one of THIS app's own upload origins -- a genuinely external,
// admin-pasted media URL (a CDN whose own file layout happens to also use
// a "/media/" prefix) would otherwise be silently rewritten to this app's
// own origin below, repointing it at whatever (if anything) this app's
// rewrite proxy serves at that identical path instead of the real
// external file. Only a host this app actually expects to have served
// content from may be narrowed: the configured NEXT_PUBLIC_SITE_URL host
// (production), or a loopback dev host (matching the backend's own
// ALLOWED_HOSTS default of "localhost,127.0.0.1" -- the exact host the
// docstring below's motivating case, an upload resolved against a dev
// machine, actually comes back as).
const OWN_MEDIA_ORIGIN_LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

function isOwnMediaOriginHost(hostname: string, siteHostname: string | null) {
  const lowered = hostname.toLowerCase();
  if (OWN_MEDIA_ORIGIN_LOOPBACK_HOSTS.has(lowered)) return true;
  return siteHostname !== null && lowered === siteHostname.toLowerCase();
}

// FE-PUBLIC-MEDIA-ORIGIN-001 (reopened): NEXT_PUBLIC_SITE_URL is a
// build-time guess at this app's public origin, and it can drift from how
// a given request actually reaches the app -- a QA canary (or any
// deployment sitting behind a proxy/port-forward) reached via
// "http://127.0.0.1:3000" while NEXT_PUBLIC_SITE_URL says
// "http://localhost:3000" is two different origins under the same-origin
// policy, even though both resolve to the same loopback address. CSP's
// img-src (same-origin only) and next/image's remotePatterns are both
// enforced against the browser's OWN current origin, not the env var, so
// rewriting toward a stale/mismatched env value can produce a URL that's
// just as cross-origin as the one being fixed. In the browser,
// window.location.origin IS the origin CSP/remotePatterns actually check
// against, so it's authoritative there; NEXT_PUBLIC_SITE_URL remains the
// only option for SSR (no window) and is still correct there since a
// server-rendered response has no "browser origin" to prefer instead.
function effectiveSiteUrl(): string | undefined {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL;
}

function normalizeMediaOrigin(url: URL): URL {
  if (!url.pathname.startsWith(MEDIA_PATH_PREFIX)) return url;
  const siteUrl = effectiveSiteUrl();
  let site: URL | null = null;
  if (siteUrl) {
    try {
      site = new URL(siteUrl);
    } catch {
      site = null;
    }
  }
  if (!site) return url;
  if (url.origin === site.origin) return url;
  if (!isOwnMediaOriginHost(url.hostname, site.hostname)) return url;
  const rewritten = new URL(url.toString());
  rewritten.protocol = site.protocol;
  rewritten.hostname = site.hostname;
  rewritten.port = site.port;
  return rewritten;
}

export function safePublicMediaUrl(value: string | null | undefined) {
  if (!value) return null;
  if (isSafeRelativePath(value)) return value;
  if (!isSafeExternalHttpUrl(value)) return null;
  // isSafeExternalHttpUrl only validates; re-parse to keep returning the
  // normalized form (e.g. a trailing "/" added to a bare origin), matching
  // this function's previous behavior.
  return normalizeMediaOrigin(new URL(value)).toString();
}

/**
 * next/image's server-side optimizer fetches a relative src as a local
 * filesystem path under public/, not through next.config.ts rewrites --
 * so a Django-served "/media/..." URL must be passed to next/image as an
 * absolute URL (allowlisted via images.remotePatterns for this app's own
 * origin, see next.config.ts) rather than stripped down to a relative path.
 * This only flags whether a media URL points somewhere OTHER than this
 * app's own origin (e.g. an admin-pasted external media_url) -- those
 * aren't covered by remotePatterns, so callers should render them
 * `unoptimized` (or as a plain <img>) instead.
 */
export function isExternalMediaUrl(value: string | null | undefined) {
  if (!value) return false;
  if (isSafeRelativePath(value)) return false;
  if (value.startsWith("/")) return true; // starts with "/" but isn't a safe relative path -- e.g. protocol-relative "//host/..."
  const siteUrl = effectiveSiteUrl();
  if (!siteUrl) return true;
  try {
    // Apply the same "/media/" origin normalization safePublicMediaUrl()
    // does (FE-PUBLIC-MEDIA-ORIGIN-001) before comparing origins -- a
    // backend media URL that this app can actually reach through its own
    // rewrite proxy must be reported as non-external so callers let
    // next/image optimize it, instead of falling back to an unoptimized
    // cross-origin fetch against whatever host the backend happened to embed.
    return normalizeMediaOrigin(new URL(value)).origin !== new URL(siteUrl).origin;
  } catch {
    return true;
  }
}
