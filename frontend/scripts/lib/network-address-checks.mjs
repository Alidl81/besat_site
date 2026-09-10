// Shared by validate-production-backend-url.mjs and
// validate-production-site-url.mjs -- both need to reject the same
// families of "not a real deployment address" hostnames, and duplicating
// this logic across two files is exactly the kind of drift that caused
// OPS-FRONTEND-MEDIA-REWRITE-001's own validator to be incomplete in the
// first place.
//
// OPS-FRONTEND-ORIGIN-VALIDATOR-001 (two independent audit rounds):
// round 1 found the original shell `case` gate only matched literal
// "127.0.0.1"/"localhost" substrings, missing IPv6 loopback/unspecified/
// link-local/metadata/RFC1918-private addresses entirely. Round 2, after
// adding those checks, found they still compared the raw parsed hostname
// against fixed literals without canonicalizing first: an IPv4-mapped
// IPv6 address got WHATWG-normalized into a compressed hex form
// (`::ffff:127.0.0.1` -> `::ffff:7f00:1`) my checks didn't recognize; a
// trailing DNS root dot ("localhost.") was never equal to the bare
// "localhost" string; IPv6 Unique Local Addresses (fc00::/7) weren't
// checked at all. Round 3, after fixing those, found a SECOND trailing
// dot ("localhost..", "127.0.0.1..") survived because only one dot was
// ever stripped, and a non-canonical IPv6 form with an *extra* zero
// group inserted before the embedded IPv4 bytes (`::ffff:0:127.0.0.1`,
// which is NOT actually within the real ::ffff:0:0/96 mapped range --
// its "ffff" lands one hextet position earlier than the RFC requires) --
// slipped past a regex written for the one specific compressed shape
// WHATWG happens to produce for the textbook case.
//
// Three rounds of individually patching new bypass shapes into the same
// allow-by-default, deny-known-bad-patterns model is the sign that model
// is the wrong one for this problem. This module now takes a narrower,
// harder-to-bypass-by-construction approach instead of a fourth patch:
//
//   - Any IPv6 literal is rejected outright, unconditionally. Neither
//     BESAT_BACKEND_API_URL nor NEXT_PUBLIC_SITE_URL has ever had a
//     documented, legitimate reason to be a raw IPv6 address in this
//     repo's compose topology (both documented-correct values --
//     "backend" and "besat.org" -- are plain DNS names), so there is no
//     finite set of IPv6 shapes to enumerate and get subtly wrong again:
//     there is simply no valid input in this category at all.
//   - A hostname must be well-formed before any semantic check runs at
//     all: no empty labels (a "..' anywhere), no leading dot, at most
//     ONE trailing dot (stripped as the equivalent-by-DNS-spec root
//     label). This closes the whole "how many trailing/embedded dots did
//     I remember to strip" class by construction rather than by chasing
//     each new dot-count as it's found.
import { isIPv4, isIPv6 } from "node:net";

function stripBrackets(host) {
  return host.replace(/^\[|\]$/g, "");
}

// A hostname is well-formed if, after removing at most one trailing DNS
// root dot, it has no leading dot and no empty label (no "..") anywhere.
// Anything else (a second trailing dot, "127.0.0.1..", a bare leading
// dot, ...) is rejected as malformed rather than guessed at.
export function isMalformedHostname(rawHost) {
  const withoutRootDot = rawHost.endsWith(".") ? rawHost.slice(0, -1) : rawHost;
  if (withoutRootDot === "") return true;
  if (withoutRootDot.startsWith(".") || withoutRootDot.endsWith(".")) return true;
  if (withoutRootDot.includes("..")) return true;
  return false;
}

// Canonicalizes a hostname for comparison: strips IPv6 brackets and the
// one legitimate trailing DNS root dot. Does NOT attempt to interpret or
// unwrap an IPv6 literal -- callers must reject those outright via
// isIPv6Literal() before this matters, per this module's design above.
export function canonicalHostname(url) {
  const bracketless = stripBrackets(url.hostname);
  const withoutRootDot = bracketless.endsWith(".") ? bracketless.slice(0, -1) : bracketless;
  return withoutRootDot.toLowerCase();
}

export function isIPv6Literal(host) {
  return isIPv6(host);
}

export function isLoopback(host) {
  if (host === "localhost") return true;
  if (isIPv4(host)) return host.startsWith("127.");
  return false;
}

export function isUnspecified(host) {
  return host === "0.0.0.0";
}

export function isLinkLocal(host) {
  return isIPv4(host) && host.startsWith("169.254.");
}

// RFC1918 private IPv4 ranges.
export function isPrivateIPv4(host) {
  if (!isIPv4(host)) return false;
  const [a, b] = host.split(".").map(Number);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

// Cloud provider instance-metadata endpoint -- never a legitimate
// deployment address, and a classic SSRF-adjacent misconfiguration target.
export function isMetadataService(host) {
  return host === "169.254.169.254";
}
