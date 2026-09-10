import "server-only";

// SEC-FE-BFF-XFP-TRUST-001: this process is not guaranteed to sit behind a
// reverse proxy that overwrites client-supplied forwarded headers, so
// x-forwarded-proto from an inbound request is untrustworthy by default --
// any client can set it to "https" to make requestOrigin() reconstruct an
// https:// origin that matches a spoofed Origin header, even though the
// mutation actually arrived over plain http. isCrossOriginMutation() would
// then treat an actual cross-scheme/cross-origin request as same-origin and
// let it through. Gate trust on the same explicit opt-in as
// x-forwarded-for (BESAT_TRUST_FORWARDED_FOR, backend-client.ts) -- both
// headers carry the same trust requirement (a proxy this deployment
// controls that sanitizes client-supplied values before they reach here),
// so a deployment that has already confirmed that trust for one has
// confirmed it for both.
const TRUST_FORWARDED_PROTO = process.env.BESAT_TRUST_FORWARDED_FOR === "true";

function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host")?.trim();

  if (!host) {
    return url.origin;
  }

  const forwardedProtocol = TRUST_FORWARDED_PROTO
    ? request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
    : undefined;
  const protocol = forwardedProtocol || url.protocol.replace(":", "");

  return `${protocol}://${host}`;
}

// SEC-FE-AUTH-LOGIN-CSRF-001: this same check already protected the
// generic backend proxy route ([...path]/route.ts), but the two other
// routes that also issue/clear the session cookie directly -- /api/session
// (login and logout) and /api/customer-registration -- never adopted it,
// so a cross-origin page could still submit a same-site-cookie-carrying
// request to them. Login/registration are POST with an attacker-supplied
// body (not a real CSRF against an existing session, but still lets a
// malicious page silently authenticate the victim's browser as a
// credential-stuffed/attacker-controlled account and set cookies for it,
// or fish for a JSON error response that reveals whether a submitted
// email/username exists), and logout is a DELETE that would silently log
// a visiting user out of Besat from an unrelated page. Extracted into this
// shared module (mirroring this codebase's established pattern of
// exporting a shared helper once a defect is fixed in one transport, so a
// second/third one can adopt it directly instead of re-deriving its own
// copy -- see resolveRequestSignal() in lib/api/client.ts) so all three
// routes enforce the identical origin policy from one place.
export function isCrossOriginMutation(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return false;
  const origin = request.headers.get("origin");
  return origin !== null && origin !== requestOrigin(request);
}
