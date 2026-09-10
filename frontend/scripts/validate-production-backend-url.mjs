// OPS-FRONTEND-MEDIA-REWRITE-001 (residual gap) + OPS-FRONTEND-ORIGIN-
// VALIDATOR-001 (three independent audit rounds -- see the detailed
// history in scripts/lib/network-address-checks.mjs's own header
// comment). This validator now rejects any IPv6 literal outright (this
// compose topology's only documented-correct value, http://backend:
// 8000/api, is a plain DNS name -- there has never been a legitimate
// reason for this to be a raw IPv6 address) and requires the hostname to
// be well-formed (no empty labels, at most one trailing DNS root dot)
// before running any semantic loopback/private/metadata check, instead
// of enumerating IPv6-embedding and multi-dot bypass shapes one at a
// time as an audit happens to find each one.
import {
  canonicalHostname,
  isIPv6Literal,
  isLinkLocal,
  isLoopback,
  isMalformedHostname,
  isMetadataService,
  isPrivateIPv4,
  isUnspecified,
} from "./lib/network-address-checks.mjs";

const MOCK_BACKEND_API_URL = "mock://local";

function fail(reason) {
  console.error(
    `BESAT_BACKEND_API_URL is invalid for a production build: ${reason}\n` +
      `Set it to the backend service's address on this compose's private network, e.g. http://backend:8000/api ` +
      `(see frontend/.env.production.example).`,
  );
  process.exit(1);
}

const raw = process.env.BESAT_BACKEND_API_URL?.trim();
if (!raw) fail("it is unset or empty.");
if (raw === MOCK_BACKEND_API_URL) {
  fail(`"${MOCK_BACKEND_API_URL}" has no real Django origin -- it's only valid for isolated/mock-mode test runs, never a production image.`);
}

let parsed;
try {
  parsed = new URL(raw);
} catch {
  fail(`"${raw}" is not a valid URL.`);
}

if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
  fail(`"${raw}" must use http:// or https://, got "${parsed.protocol}".`);
}

const rawHostname = parsed.hostname.replace(/^\[|\]$/g, "");

if (isIPv6Literal(rawHostname)) {
  fail(
    `"${raw}" is a raw IPv6 address ("${rawHostname}"). Use the Docker Compose service's DNS name instead (e.g. http://backend:8000/api) -- this compose topology has no documented use for a raw IPv6 backend address, and IPv6 literals have repeatedly hidden loopback/private-range bypasses behind non-obvious canonical forms.`,
  );
}
if (isMalformedHostname(rawHostname)) {
  fail(`"${raw}" is not a well-formed hostname ("${rawHostname}").`);
}

const hostname = canonicalHostname(parsed);

if (isMetadataService(hostname)) {
  fail(`"${raw}" resolves to a cloud instance-metadata address ("${hostname}"), never a legitimate backend origin.`);
}
if (isLoopback(hostname)) {
  fail(`"${raw}" resolves to loopback ("${hostname}"), which can never reach the real backend service from inside the frontend container.`);
}
if (isUnspecified(hostname)) {
  fail(`"${raw}" resolves to the unspecified address ("${hostname}"), which is not a real backend destination.`);
}
if (isLinkLocal(hostname)) {
  fail(`"${raw}" resolves to a link-local address ("${hostname}"), which is not a stable backend destination.`);
}
if (isPrivateIPv4(hostname)) {
  fail(
    `"${raw}" is a raw private IP ("${hostname}"). Use the Docker Compose service's DNS name instead (e.g. http://backend:8000/api) -- a raw IP bypasses Compose's own service discovery and is not guaranteed stable across restarts.`,
  );
}

// OPS-FE-BACKEND-URL-RUNTIME-001 (reopened, residual -- mirrored here from
// the runtime fix in src/lib/network-address-checks.ts's
// describeUnsafeBackendOrigin() for the same reason every other check in
// this file mirrors that module: rejecting the obviously-wrong address
// classes above is not the same as only accepting the one right one. This
// compose topology has exactly one documented-correct backend destination
// -- the Compose service name "backend" -- so an arbitrary *other* public
// host, or a URL carrying embedded credentials, previously passed this
// build-time gate untouched.
if (parsed.username !== "" || parsed.password !== "") {
  fail(`"${raw}" must not embed a username/password in the URL itself.`);
}
if (hostname !== "backend") {
  fail(
    `"${raw}" is not an approved backend destination ("${hostname}"). This deployment only ever routes backend traffic to its own Compose service name -- use http://backend:8000/api.`,
  );
}

console.log(`BESAT_BACKEND_API_URL is valid: ${raw}`);
