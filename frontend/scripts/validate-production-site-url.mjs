// OPS-PROD-DOC-DRIFT-001 (recommended fix) + OPS-FRONTEND-ORIGIN-
// VALIDATOR-001 (three independent audit rounds -- see the detailed
// history in scripts/lib/network-address-checks.mjs's own header
// comment). This validator now rejects any IPv6 literal outright (this
// repo's only documented-correct value, https://besat.org, is a plain
// DNS name -- there has never been a legitimate reason for a production
// public origin to be a raw IPv6 address here) and requires the hostname
// to be well-formed (no empty labels, at most one trailing DNS root dot)
// before running any semantic loopback/private/placeholder check.
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

// RFC 2606 reserved "this is definitely a placeholder" domains, plus the
// two literal example values this repo's own templates show operators
// (frontend/.env.production.example's "your-domain.example" and
// lib/site-url.ts's own non-production fallback "besat.example.com") --
// an operator who copies the example file without editing this one line
// would otherwise sail straight through a bare "is it a valid https URL"
// check.
const PLACEHOLDER_HOSTNAMES = [
  "example.com",
  "example.org",
  "example.net",
  "example.edu",
  "your-domain.example",
  "besat.example.com",
];

function fail(reason) {
  console.error(
    `NEXT_PUBLIC_SITE_URL is invalid for a production build: ${reason}\n` +
      `Set it to the real public origin end users load the site from, e.g. https://besat.org ` +
      `(see frontend/.env.production.example).`,
  );
  process.exit(1);
}

const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
if (!raw) fail("it is unset or empty.");

let parsed;
try {
  parsed = new URL(raw);
} catch {
  fail(`"${raw}" is not a valid URL.`);
}

if (parsed.protocol !== "https:") {
  fail(`"${raw}" must use https://, got "${parsed.protocol}" -- a production public origin always has real TLS.`);
}

// OPS-FE-SITE-URL-SHAPE-001: NEXT_PUBLIC_SITE_URL feeds the same
// runtime-resolved value robots.ts/sitemap.ts/shop/news metadata routes
// concatenate route suffixes onto directly -- a path/query/fragment/
// embedded-userinfo value here produces the identical malformed-metadata
// and credential-leak risk resolveSiteUrl() (frontend/src/lib/site-url.ts)
// now guards against at runtime. Checked unconditionally: there is no
// legitimate reason to intentionally set this to anything but a bare origin.
if (
  (parsed.pathname !== "/" && parsed.pathname !== "") ||
  parsed.search !== "" ||
  parsed.hash !== "" ||
  parsed.username !== "" ||
  parsed.password !== ""
) {
  fail(`"${raw}" must be a bare origin with no path, query string, fragment, or embedded credentials.`);
}

const rawHostname = parsed.hostname.replace(/^\[|\]$/g, "");

if (isIPv6Literal(rawHostname)) {
  fail(
    `"${raw}" is a raw IPv6 address ("${rawHostname}"). Use the real public domain instead (e.g. https://besat.org) -- there has never been a documented use for a raw IPv6 public origin here, and IPv6 literals have repeatedly hidden loopback/private-range bypasses behind non-obvious canonical forms.`,
  );
}
if (isMalformedHostname(rawHostname)) {
  fail(`"${raw}" is not a well-formed hostname ("${rawHostname}").`);
}

const hostname = canonicalHostname(parsed);

if (isMetadataService(hostname)) {
  fail(`"${raw}" resolves to a cloud instance-metadata address ("${hostname}"), never a legitimate public origin.`);
}
if (isLoopback(hostname)) {
  fail(`"${raw}" resolves to loopback ("${hostname}") -- this is the exact development fallback this check exists to catch.`);
}
if (isUnspecified(hostname)) {
  fail(`"${raw}" resolves to the unspecified address ("${hostname}"), which is not a real public origin.`);
}
if (isLinkLocal(hostname)) {
  fail(`"${raw}" resolves to a link-local address ("${hostname}"), which is not a real public origin.`);
}
if (isPrivateIPv4(hostname)) {
  fail(`"${raw}" is a private IP ("${hostname}"), which is never reachable as a public origin from a real visitor's browser.`);
}
if (PLACEHOLDER_HOSTNAMES.includes(hostname)) {
  fail(`"${raw}" looks like an unedited template placeholder ("${hostname}"). Replace it with the real production domain.`);
}

console.log(`NEXT_PUBLIC_SITE_URL is valid: ${raw}`);
