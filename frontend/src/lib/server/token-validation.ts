import "server-only";

// AUTH-FE-BFF-REFRESH-EMPTY-TOKENS-001 / AUTH-FE-SESSION-EMPTY-TOKENS-001:
// three separate places accept an upstream auth response's access/refresh
// fields as usable the moment they're merely typeof "string" -- an empty
// string ("") or a whitespace-only one ("   ") passes that check just as
// readily as a real token, then gets used as a Bearer credential (a
// blank-bearer replay request) and/or written into a session cookie with
// a real, nonzero Max-Age. A malformed or misbehaving upstream response
// shaped this way used to look exactly like a successful rotation/login
// instead of the unusable payload it actually is. Shared here so the BFF
// refresh path ([...path]/route.ts) and the two cookie-issuing routes
// (/api/session, /api/customer-registration) apply the identical check
// rather than each re-deriving their own -- the established pattern this
// codebase already uses for a shared timeout deadline
// (resolveRequestSignal) and a shared origin check (isCrossOriginMutation).
export function isNonEmptyToken(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
