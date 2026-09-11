import "server-only";
import { HAS_SESSION_COOKIE_NAME } from "@/lib/auth/session-marker-cookie";

export const sessionCookieNames = {
  access: 'besat_access',
  refresh: 'besat_refresh',
  // Non-HttpOnly marker: mirrors whether a session cookie pair was just set
  // (login) or cleared (logout / failed silent refresh), so client code can
  // check `document.cookie` and skip a doomed `/me` request -- and the red
  // 401 console error that comes with it -- for a visitor who has no
  // session at all, instead of always making the request to find out.
  hasSession: HAS_SESSION_COOKIE_NAME,
} as const;

const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

type SessionTokens = {
  access: string;
  refresh: string;
};

function cookieAttributes(maxAge: number, { httpOnly = true }: { httpOnly?: boolean } = {}) {
  const attributes = ['Path=/', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (httpOnly) attributes.push('HttpOnly');
  if (process.env.NODE_ENV === 'production') attributes.push('Secure');
  return attributes.join('; ');
}

function serializeCookie(
  name: string,
  value: string,
  maxAge: number,
  options?: { httpOnly?: boolean },
) {
  return `${name}=${encodeURIComponent(value)}; ${cookieAttributes(maxAge, options)}`;
}

export function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const entry = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch {
    return null;
  }
}

export function appendSessionCookies(headers: Headers, tokens: SessionTokens) {
  headers.append(
    'set-cookie',
    serializeCookie(sessionCookieNames.access, tokens.access, 30 * 60),
  );
  headers.append(
    'set-cookie',
    serializeCookie(sessionCookieNames.refresh, tokens.refresh, REFRESH_MAX_AGE),
  );
  // Mirrors the refresh cookie's lifetime, not the shorter-lived access
  // cookie's: as long as a refresh token could still silently resurrect the
  // session, client code should keep treating "worth checking" as true.
  headers.append(
    'set-cookie',
    serializeCookie(sessionCookieNames.hasSession, '1', REFRESH_MAX_AGE, { httpOnly: false }),
  );
}

export function clearSessionCookies(headers: Headers) {
  headers.append('set-cookie', serializeCookie(sessionCookieNames.access, '', 0));
  headers.append('set-cookie', serializeCookie(sessionCookieNames.refresh, '', 0));
  headers.append(
    'set-cookie',
    serializeCookie(sessionCookieNames.hasSession, '', 0, { httpOnly: false }),
  );
}

export function appendAnonymousThrottleCookie(headers: Headers, value: string) {
  const attributes = ["Path=/", "SameSite=Lax", "Max-Age=31536000", "HttpOnly"];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  headers.append("set-cookie", `${ANONYMOUS_THROTTLE_COOKIE_NAME}=${encodeURIComponent(value)}; ${attributes.join("; ")}`);
}

export const ANONYMOUS_THROTTLE_COOKIE_NAME = "besat_anon_id";
