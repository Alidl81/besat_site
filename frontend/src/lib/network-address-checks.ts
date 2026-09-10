// OPS-FE-SITE-URL-RUNTIME-HOST-001 / OPS-FE-BACKEND-URL-RUNTIME-001: the
// build-time validators (frontend/scripts/validate-production-site-url.mjs,
// validate-production-backend-url.mjs) reject loopback/private/link-local/
// metadata/malformed/placeholder hosts for NEXT_PUBLIC_SITE_URL and the
// Docker build ARG -- but the actual RUNTIME resolvers app code calls on
// every request (resolveSiteUrl() in site-url.ts, getBackendBaseUrl() in
// lib/server/backend-client.ts) never applied any of those checks. A
// runtime env var can differ from what was validated at build/deploy time
// (docker-compose.prod.yml's env_file wiring, an operator override, ...),
// and neither resolver rejected it.
//
// This is a TypeScript port of frontend/scripts/lib/network-address-checks.mjs
// (see that file's own header for the full three-round reject-by-
// construction audit history this design is based on: reject any IPv6
// literal outright, require a well-formed hostname before any semantic
// check runs). It is a SEPARATE file rather than one shared import because
// scripts/ run via plain `node scripts/foo.mjs` with no TypeScript
// compilation step, so they cannot import from src/, and src/ is bundled
// by Next's compiler, so it cannot import a script meant for direct `node`
// execution either -- these are two different module-execution contexts
// with no low-friction way to share one file without extra build tooling.
// Any change to the semantic checks below should be mirrored in the
// scripts/ copy, and vice versa.
//
// OPS-FE-SERVER-API-URL-RUNTIME-001 (build failure caught before shipping):
// this module is imported from lib/api/client.ts, which -- unlike site-url.ts
// and lib/server/backend-client.ts -- is a UNIVERSAL module also imported by
// "use client" components. A first attempt at this file used node:net's
// isIPv4/isIPv6, which broke the actual production build outright
// ("UnhandledSchemeError: Reading from 'node:net' is not handled by
// plugins", confirmed via a real `npm run build`): webpack bundles a
// module's full static import graph for whichever bundle references it
// (client or server) regardless of a runtime `typeof window` guard deeper
// in the calling code, so a Node-builtin import here poisons the client
// bundle even though every actual CALLER of this module only invokes it
// from a server-only branch. This version has zero Node-specific
// dependencies -- IPv4/IPv6 detection below is pure string/regex logic --
// so it's safe to import from a universal module.
function stripBrackets(host: string) {
  return host.replace(/^\[|\]$/g, "");
}

// A WHATWG URL always brackets an IPv6 host in `.hostname` (e.g.
// `new URL("http://[::1]:8000/").hostname === "[::1]"`) -- no plain
// hostname or IPv4 literal is ever bracketed, so this is a reliable,
// regex-free way to detect "was this host an IPv6 literal" without
// needing to validate IPv6 syntax at all. Must be checked against the
// RAW (still-bracketed) hostname, before stripBrackets() runs.
function isBracketedIPv6Host(rawHostname: string): boolean {
  return rawHostname.startsWith("[") && rawHostname.endsWith("]");
}

// Deliberately permissive (accepts e.g. a leading-zero octet like "01"):
// this only needs to reliably recognize "this is IPv4-shaped" so the
// loopback/private/link-local checks below can inspect its octets: being
// slightly over-inclusive about what counts as IPv4 only makes this
// module MORE likely to flag something as an unsafe address, never less.
function isIPv4Literal(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  return match.slice(1).every((octet) => Number(octet) <= 255);
}

export function isMalformedHostname(rawHost: string): boolean {
  const withoutRootDot = rawHost.endsWith(".") ? rawHost.slice(0, -1) : rawHost;
  if (withoutRootDot === "") return true;
  if (withoutRootDot.startsWith(".") || withoutRootDot.endsWith(".")) return true;
  if (withoutRootDot.includes("..")) return true;
  return false;
}

export function canonicalHostname(url: URL): string {
  const bracketless = stripBrackets(url.hostname);
  const withoutRootDot = bracketless.endsWith(".") ? bracketless.slice(0, -1) : bracketless;
  return withoutRootDot.toLowerCase();
}

export function isLoopback(host: string): boolean {
  if (host === "localhost") return true;
  if (isIPv4Literal(host)) return host.startsWith("127.");
  return false;
}

export function isUnspecified(host: string): boolean {
  return host === "0.0.0.0";
}

export function isLinkLocal(host: string): boolean {
  return isIPv4Literal(host) && host.startsWith("169.254.");
}

export function isPrivateIPv4(host: string): boolean {
  if (!isIPv4Literal(host)) return false;
  const [a, b] = host.split(".").map(Number);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function isMetadataService(host: string): boolean {
  return host === "169.254.169.254";
}

/**
 * Returns a human-readable rejection reason for a parsed URL's host, or
 * `null` if the host clears every network-address-class check. Shared by
 * resolveSiteUrl() and getBackendBaseUrl() so both apply the identical
 * fail-closed policy to whatever they resolve at runtime. Deliberately
 * does NOT include a placeholder-hostname check -- "besat.example.com" is
 * a meaningful rejection for a public *site* origin but not for a
 * *backend service* origin (a backend legitimately named "example.com" in
 * some other deployment isn't the same category of mistake); callers that
 * need it apply their own placeholder list on top, same as the build-time
 * validate-production-site-url.mjs does relative to the shared .mjs module.
 */
export function describeUnsafeDeploymentHost(parsed: URL): string | null {
  if (isBracketedIPv6Host(parsed.hostname)) {
    return `is a raw IPv6 address ("${parsed.hostname}") -- there is no documented legitimate reason for a production deployment destination here to be IPv6`;
  }

  const rawHost = stripBrackets(parsed.hostname);

  if (isMalformedHostname(rawHost)) {
    return `is not a well-formed hostname ("${rawHost}")`;
  }

  const host = canonicalHostname(parsed);

  if (isMetadataService(host)) {
    return `resolves to a cloud instance-metadata address ("${host}"), never a legitimate deployment destination`;
  }
  if (isLoopback(host)) {
    return `resolves to loopback ("${host}")`;
  }
  if (isUnspecified(host)) {
    return `resolves to the unspecified address ("${host}")`;
  }
  if (isLinkLocal(host)) {
    return `resolves to a link-local address ("${host}")`;
  }
  if (isPrivateIPv4(host)) {
    return `is a private IP ("${host}"), never reachable as intended from outside this deployment's own network`;
  }

  return null;
}

// OPS-FE-BACKEND-URL-RUNTIME-001 (reopened, residual): rejecting the
// obviously-wrong address classes above (loopback/private/metadata/
// malformed) is not the same as only accepting the RIGHT one. This
// compose topology has exactly one documented-correct backend
// destination -- the Docker Compose service DNS name "backend" (see
// frontend/.env.production.example: "BESAT_BACKEND_API_URL=
// http://backend:8000/api ... this traffic never needs to leave the
// deployment's internal network") -- so an arbitrary *public* hostname
// (an attacker-controlled or simply unapproved one) previously sailed
// through untouched, since it isn't loopback/private/metadata/malformed.
// An explicit allowlist closes that by construction instead of trying to
// enumerate every "public but wrong" host. This is intentionally NOT part
// of describeUnsafeDeploymentHost() above -- that function's callers
// (resolveSiteUrl()) legitimately need to accept a real public hostname
// (the site's own domain), so a one-hostname allowlist only belongs where
// there is genuinely only one correct destination: the backend origin.
const APPROVED_BACKEND_HOSTNAMES = new Set(["backend"]);

/**
 * Runtime-safe check for a resolved *backend* origin specifically (used by
 * both getBackendBaseUrl() in lib/server/backend-client.ts and
 * getApiBaseUrl()'s server branch in lib/api/client.ts, which resolves the
 * same "where is the backend" question through a separate, unvalidated
 * code path -- see OPS-FE-SERVER-API-URL-RUNTIME-001). Combines the
 * generic network-address checks, an explicit approved-hostname allowlist,
 * and a check for embedded userinfo credentials (a backend origin has no
 * legitimate reason to carry a username/password in the URL itself).
 */
export function describeUnsafeBackendOrigin(parsed: URL): string | null {
  if (parsed.username !== "" || parsed.password !== "") {
    return "must not embed a username/password in the URL itself";
  }

  const networkReason = describeUnsafeDeploymentHost(parsed);
  if (networkReason) return networkReason;

  const host = canonicalHostname(parsed);
  if (!APPROVED_BACKEND_HOSTNAMES.has(host)) {
    return `is not an approved backend destination ("${host}") -- this deployment only ever routes backend traffic to its own Compose service name`;
  }

  return null;
}

// RFC 2606 reserved domains plus this repo's own two example placeholders
// (frontend/.env.production.example's "your-domain.example" and
// site-url.ts's own non-production fallback "besat.example.com") -- kept
// in sync with validate-production-site-url.mjs's identical list. Only
// meaningful for a public *site* origin -- see describeUnsafeDeploymentHost's
// own comment for why this isn't folded into that shared check.
export const PLACEHOLDER_HOSTNAMES = new Set([
  "example.com",
  "example.org",
  "example.net",
  "example.edu",
  "your-domain.example",
  "besat.example.com",
]);
