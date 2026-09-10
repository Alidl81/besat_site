import { afterEach, describe, expect, it, vi } from "vitest";
import { isExternalMediaUrl, safePublicMediaUrl } from "@/lib/media/safe-url";

// SEC-FE-PUBLIC-MEDIA-PARSER-001: the absolute-URL branch used to be a
// bare `new URL(value)` + protocol check, which (like the pre-fix
// media-picker-dialog.tsx and lib/url-safety.ts) accepted backslash-scheme
// forms that parse identically to the honest forward-slash form -- e.g.
// "http:\\evil.example/pixel.jpg" resolves to the same host as
// "http://evil.example/pixel.jpg". Now delegates to the shared,
// already-hardened isSafeExternalHttpUrl().
describe("safePublicMediaUrl absolute parser-normalization boundary", () => {
  it("rejects absolute HTTP(S) values whose backslashes normalize to another host", () => {
    const candidates = [
      "http:\\\\evil.example/pixel.jpg",
      "http:/\\/evil.example/pixel.jpg",
      "https:\\\\evil.example/pixel.jpg",
    ];

    for (const candidate of candidates) {
      expect(safePublicMediaUrl(candidate), candidate).toBeNull();
      expect(new URL(candidate).hostname).toBe("evil.example");
    }
  });

  it("still accepts a genuine absolute https URL", () => {
    expect(safePublicMediaUrl("https://cdn.example.com/image.jpg")).toBe("https://cdn.example.com/image.jpg");
  });

  it("still accepts a genuine same-origin relative path", () => {
    expect(safePublicMediaUrl("/media/photo.jpg")).toBe("/media/photo.jpg");
  });

  it("still rejects a protocol-relative path", () => {
    expect(safePublicMediaUrl("//evil.example/pixel.jpg")).toBeNull();
  });
});

// FE-PUBLIC-MEDIA-ORIGIN-001: a "/media/..." URL the backend built with the
// wrong Host (e.g. resolved to "localhost:3000" behind a proxy in a real
// deployment) is unreachable as-is from a real visitor's browser and trips
// the CSP img-src allowlist. next.config.ts's rewrites() proxies this app's
// own "/media/:path*" straight through to the real backend regardless of
// origin, so rewriting to this app's own known-good origin always works.
//
// Every test in this block also stubs window.location.origin to match
// whatever origin it's simulating "being viewed from" -- effectiveSiteUrl()
// now prefers window.location.origin over NEXT_PUBLIC_SITE_URL whenever a
// window exists (see the reopened-finding test below for why), and jsdom
// always provides a window with some default origin, so leaving it
// unstubbed would silently substitute that default in place of whatever
// origin each test means to simulate.
describe("safePublicMediaUrl / isExternalMediaUrl media-origin normalization", () => {
  const originalLocation = window.location;

  function stubLocationOrigin(origin: string) {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, origin },
    });
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("rewrites a wrong-origin /media/ URL to the site's own origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://besat.example.com");
    stubLocationOrigin("https://besat.example.com");
    expect(safePublicMediaUrl("http://localhost:3000/media/products/a.jpg")).toBe(
      "https://besat.example.com/media/products/a.jpg",
    );
  });

  it("reports a /media/ URL as non-external once normalized, even with a mismatched origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://besat.example.com");
    stubLocationOrigin("https://besat.example.com");
    expect(isExternalMediaUrl("http://localhost:3000/media/products/a.jpg")).toBe(false);
  });

  it("leaves a /media/ URL that already matches the site origin unchanged", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://besat.example.com");
    stubLocationOrigin("https://besat.example.com");
    expect(safePublicMediaUrl("https://besat.example.com/media/products/a.jpg")).toBe(
      "https://besat.example.com/media/products/a.jpg",
    );
  });

  it("does not rewrite a non-/media/ absolute URL even with a mismatched origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://besat.example.com");
    stubLocationOrigin("https://besat.example.com");
    expect(safePublicMediaUrl("https://cdn.example.com/image.jpg")).toBe("https://cdn.example.com/image.jpg");
    expect(isExternalMediaUrl("https://cdn.example.com/image.jpg")).toBe(true);
  });

  it("leaves the URL unchanged when no site origin is known (SSR, no window)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubGlobal("window", undefined);
    expect(safePublicMediaUrl("http://localhost:3000/media/products/a.jpg")).toBe(
      "http://localhost:3000/media/products/a.jpg",
    );
  });

  // SEC-FE-RICH-MEDIA-ORIGIN-002 (backend mirror): a genuinely external
  // host whose own file layout coincidentally also uses a "/media/"
  // prefix (an admin-pasted CDN image, say) must be left untouched, not
  // silently repointed at this app's own origin just because the path
  // happens to match.
  it("does not rewrite a /media/ URL on a genuinely different, non-loopback host", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://besat.example.com");
    stubLocationOrigin("https://besat.example.com");
    expect(safePublicMediaUrl("https://cdn.example.com/media/remote.jpg")).toBe(
      "https://cdn.example.com/media/remote.jpg",
    );
    expect(isExternalMediaUrl("https://cdn.example.com/media/remote.jpg")).toBe(true);
  });

  // FE-PUBLIC-MEDIA-ORIGIN-001 (reopened): Codex's live retest viewed the
  // canonical QA container from "http://127.0.0.1:3000" while
  // NEXT_PUBLIC_SITE_URL said "http://localhost:3000" -- two different
  // origins under the same-origin policy even though both are loopback,
  // so a persisted media URL that already matched the *configured* origin
  // was still genuinely cross-origin from the browser's *actual* current
  // one, tripping CSP img-src and leaving every thumbnail unloaded
  // (naturalWidth=0). window.location.origin is what CSP and next/image's
  // remotePatterns actually check against, so it must win over a merely
  // configured value once a window exists.
  it("rewrites toward the browser's actual current origin, not a stale/mismatched NEXT_PUBLIC_SITE_URL, when they're different loopback hosts", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    stubLocationOrigin("http://127.0.0.1:3000");
    expect(safePublicMediaUrl("http://localhost:3000/media/products/a.jpg")).toBe(
      "http://127.0.0.1:3000/media/products/a.jpg",
    );
  });
});
