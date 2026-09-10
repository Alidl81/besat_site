// Shared between server (src/lib/server/session-cookies.ts, which sets and
// clears this cookie) and client (src/services/auth-service.ts, which reads
// it) code, so the name can't drift between the two sides. Kept out of
// session-cookies.ts itself because that module is "server-only" and this
// name needs to be importable from client components too.
export const HAS_SESSION_COOKIE_NAME = "besat_has_session";

// FE-SHOP-GUEST-CART-MERGE-RETRY-001: any client-side code that needs to
// know "is there a real session right now" should read this cookie, not
// auth-session.ts's readBesatSession() -- that display cache is written by
// a client-side effect only AFTER an async getCurrentUser() call resolves,
// so a component mounting immediately after a redirect (e.g. the shop cart
// page right after login) can race ahead of that write and see no session
// even though one genuinely exists. besat_has_session is set by the server
// itself as part of the same response that sets the real (HttpOnly) session
// cookies, so it is present the instant the browser has those cookies at
// all -- no async client write to race against.
export function hasSessionCookie(): boolean {
  if (typeof document === "undefined") return true;
  return document.cookie
    .split(";")
    .some((part) => part.trim().startsWith(`${HAS_SESSION_COOKIE_NAME}=`));
}
