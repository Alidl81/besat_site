// FE-SEO-PROD-ORIGIN-001 (2nd round): the first fix made robots.ts/sitemap.ts
// force-dynamic and read a non-public SITE_URL first -- but both still fell
// back to NEXT_PUBLIC_SITE_URL when SITE_URL was left unset, and that
// fallback is webpack-inlined at `next build` time, so a deployment that
// forgets to also set the new SITE_URL key silently reproduces the exact
// original bug. There is no safe automatic fallback for a production
// deployment's real public origin -- only an operator can supply it -- so
// this resolver fails closed (throws) in production when SITE_URL is
// missing or isn't a well-formed https:// origin, rather than guessing.
// Development keeps a lenient placeholder fallback so local `next dev`/test
// runs aren't disrupted by requiring every checkout to set it.
//
import {
  canonicalHostname,
  describeUnsafeDeploymentHost,
  PLACEHOLDER_HOSTNAMES,
} from "@/lib/network-address-checks";

// OPS-FE-SITE-URL-SHAPE-001: this used to only check the *protocol*,
// silently accepting a SITE_URL that also carried a path, query string,
// fragment, or embedded userinfo (`https://besat.org/foo`,
// `?q=1`, `#frag`, `https://user:pass@besat.org`). Every consumer
// (robots.ts, sitemap.ts, the shop/news metadata routes) treats the
// resolved value as a bare origin and concatenates route suffixes onto it
// directly -- a shaped value produces malformed canonical URLs/sitemap
// entries, and an embedded username/password would leak straight into
// public metadata. isBareOrigin() rejects anything but a clean origin
// unconditionally (not just in production): there is no legitimate reason
// to intentionally set SITE_URL to anything else, in any environment.
function isBareOrigin(parsed: URL): boolean {
  return (
    (parsed.pathname === "/" || parsed.pathname === "") &&
    parsed.search === "" &&
    parsed.hash === "" &&
    parsed.username === "" &&
    parsed.password === ""
  );
}

export function resolveSiteUrl(): string {
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) {
    let parsed: URL;
    try {
      parsed = new URL(explicit);
    } catch {
      throw new Error(
        `FE-SEO-PROD-ORIGIN-001: SITE_URL is not a valid URL ("${explicit}"). Set it to the real public origin, e.g. https://besat.org.`,
      );
    }
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
      throw new Error(
        `FE-SEO-PROD-ORIGIN-001: SITE_URL must use https:// in production ("${explicit}").`,
      );
    }
    if (!isBareOrigin(parsed)) {
      throw new Error(
        `OPS-FE-SITE-URL-SHAPE-001: SITE_URL must be a bare origin with no path, query string, fragment, or embedded credentials ("${explicit}"). Set it to just the origin, e.g. https://besat.org.`,
      );
    }
    // OPS-FE-SITE-URL-RUNTIME-HOST-001: the build-time validator
    // (scripts/validate-production-site-url.mjs) already rejects a
    // non-public NEXT_PUBLIC_SITE_URL, but that only covers the value
    // webpack inlines at build time -- it never checked the SITE_URL this
    // function actually reads at runtime, so a syntactically valid but
    // non-public value (loopback, private, metadata, or an unedited
    // "besat.example.com"/"example.com." placeholder) sailed straight
    // through and got served in robots.txt/sitemap.xml/canonical/OG/
    // JSON-LD output. Gated to production only, same as the https:// and
    // bare-origin checks above -- local dev is allowed to point this at
    // whatever's convenient.
    if (process.env.NODE_ENV === "production") {
      const unsafeReason = describeUnsafeDeploymentHost(parsed);
      if (unsafeReason) {
        throw new Error(
          `OPS-FE-SITE-URL-RUNTIME-HOST-001: SITE_URL ${unsafeReason} ("${explicit}"). Set it to the real public origin, e.g. https://besat.org.`,
        );
      }
      if (PLACEHOLDER_HOSTNAMES.has(canonicalHostname(parsed))) {
        throw new Error(
          `OPS-FE-SITE-URL-RUNTIME-HOST-001: SITE_URL looks like an unedited template placeholder ("${explicit}"). Set it to the real public origin, e.g. https://besat.org.`,
        );
      }
    }
    return explicit.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FE-SEO-PROD-ORIGIN-001: SITE_URL is required in production for robots.txt/sitemap.xml to resolve the real public origin. NEXT_PUBLIC_SITE_URL is not a safe fallback here -- it is webpack-inlined at `next build` time and cannot reflect a value only supplied at container runtime.",
    );
  }
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://besat.example.com").replace(/\/$/, "");
}
