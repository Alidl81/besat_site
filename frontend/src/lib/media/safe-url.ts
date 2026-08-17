export function safePublicMediaUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("/")) return value;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
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
  if (!value || value.startsWith("/")) return false;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return true;
  try {
    return new URL(value).origin !== new URL(siteUrl).origin;
  } catch {
    return true;
  }
}
