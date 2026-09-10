// FE-AUTH-OPEN-REDIRECT-001: a bare `next.startsWith("/")` check (the
// previous validation in login-card.tsx/register-card.tsx) also accepted a
// protocol-relative "next" value that browsers resolve off-origin. See
// isSafeRelativePath() for the full check -- shared with the media-URL
// sanitizer fix for FE-RICH-MEDIA-PROTOCOL-RELATIVE-001, since both need
// the identical "leading slash doesn't guarantee same-origin" guarantee.
import { isSafeRelativePath } from "@/lib/url-safety";

export function getSafeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return isSafeRelativePath(raw) ? raw : null;
}
