import type { NextConfig } from "next";

const requestedDistDir = process.env.BESAT_NEXT_DIST_DIR;
const distDir =
  requestedDistDir && /^\.next(?:[-_a-zA-Z0-9]+)?$/.test(requestedDistDir)
    ? requestedDistDir
    : ".next";
// OPS-TSCONFIG-EPHEMERAL-INCLUDE-001: whenever `next build`/`next dev` runs
// against a non-default dist dir (BESAT_NEXT_DIST_DIR above) without a
// matching isolated tsconfig, it "helpfully" appends `include` globs for
// that dist dir straight into the real, git-tracked tsconfig.json -- and
// since this happens every time a disposable/QA/test build uses a fresh
// dist-dir name, the tracked file accumulates stale entries for
// directories that are themselves gitignored (`.next-playwright-*`,
// `.next-qg-*`, ...) and were never meant to be committed. This regex
// previously only matched the `.next-playwright-*` naming convention, so
// any OTHER custom dist-dir convention (e.g. `.next-qg-*`, used by this
// repo's QA tooling) had no way to request an isolated tsconfig and always
// fell back to mutating the tracked one. Broadened to match any
// `.next<suffix>.tsconfig.json` name, mirroring BESAT_NEXT_DIST_DIR's own
// permissive suffix charset above, so ANY disposable dist-dir convention
// can supply its own isolated tsconfig instead.
const requestedTypeScriptConfig = process.env.BESAT_NEXT_TSCONFIG_PATH;
const typeScriptConfigPath =
  requestedTypeScriptConfig &&
  /^\.next[-_a-zA-Z0-9]*\.tsconfig\.json$/.test(requestedTypeScriptConfig)
    ? requestedTypeScriptConfig
    : undefined;

// The BFF proxy (src/app/api/backend/[...path]/route.ts) is the only
// intended path to the Django backend for JSON requests, but uploaded media
// (gallery images, product photos, virtual tour panoramas, ...) is served
// by Django itself as plain file responses at MEDIA_URL, and the backend
// builds those URLs against the frontend's own origin (see
// TRUST_PROXY_HEADERS in backend/config/settings/base.py). Without this
// rewrite, a browser fetching "<frontend origin>/media/..." would 404 since
// Next.js has no route for it. Skipped for the mock backend, which has no
// real Django origin to proxy to.
const backendApiUrl = process.env.BESAT_BACKEND_API_URL?.trim();
const backendOrigin =
  backendApiUrl && backendApiUrl !== "mock://local"
    ? (() => {
        try {
          return new URL(backendApiUrl).origin;
        } catch {
          return null;
        }
      })()
    : null;

// next/image treats any absolute URL as "remote" and requires it to be
// allowlisted here -- including URLs on this app's own origin, since the
// backend builds absolute media URLs against the frontend's origin (see
// TRUST_PROXY_HEADERS in backend/config/settings/base.py). Without this,
// next/image's server-side optimizer 400s on every gallery/product/avatar
// image fetched through the "/media/*" rewrite above.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const siteOrigin = siteUrl
  ? (() => {
      try {
        return new URL(siteUrl);
      } catch {
        return null;
      }
    })()
  : null;

// SEC-FE-HEADERS-001: production responses had no security headers at all
// (curl against a real production build showed a bare `X-Powered-By:
// Next.js` and nothing else) -- there's no proxy/middleware in this repo to
// add them at the edge, and no evidence any trusted ingress does either.
// Nonce-based CSP (Next's own recommended strict approach) requires forcing
// every single page to dynamic rendering app-wide, which would silently
// undo the static-generation wins already relied on across ~20 marketing
// pages -- so this follows Next's documented "Without Nonces" static
// next.config.js CSP instead. `'unsafe-inline'` on script/style is required
// without nonce infrastructure (Next's own hydration bootstrap script has
// no other way to run); the CMS embed block (structured-content.ts) only
// ever normalizes video URLs to youtube-nocookie.com/player.vimeo.com, and
// the media library serializer (backend/apps/core/serializers.py) allows an
// admin-pasted external image/video URL alongside same-origin uploads --
// both reflected in frame-src/img-src/media-src below instead of narrowing
// to 'self' and breaking those existing, intentional features.
const isDev = process.env.NODE_ENV === "development";
const cspHeader = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Browser test servers use a project-local isolated build directory so they
  // never contend with a developer's active `.next` lock.
  distDir,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  ...(typeScriptConfigPath ? { typescript: { tsconfigPath: typeScriptConfigPath } } : {}),
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.10.65", "192.168.10.71"],
  skipTrailingSlashRedirect: true,
  outputFileTracingIncludes: {
    "/*": ["./data/mock-database.seed.json"],
  },
  ...(backendOrigin
    ? {
        async rewrites() {
          return [{ source: "/media/:path*", destination: `${backendOrigin}/media/:path*` }];
        },
      }
    : {}),
  ...(siteOrigin
    ? {
        images: {
          // FE-DASH-AVATAR-MEDIA-ORIGIN-001 (follow-up): lib/media/safe-url.ts's
          // effectiveSiteUrl() treats "localhost" and "127.0.0.1" as
          // interchangeable loopback hosts and prefers whichever one the
          // browser is ACTUALLY viewing the page from (window.location.origin)
          // over this static, build-time siteOrigin -- so a QA canary (or any
          // deployment) reached via "127.0.0.1" while NEXT_PUBLIC_SITE_URL
          // names "localhost" correctly renders "127.0.0.1" media URLs
          // as-is (they already match the real current origin, no rewrite
          // needed). But next/image validates its own `src` against ONLY
          // this static remotePatterns list, with no awareness of the
          // browser's actual origin at all -- so a "127.0.0.1" URL that the
          // rest of the app now correctly treats as safe/unchanged still
          // threw `next/image`'s own "Invalid src prop ... hostname ...
          // is not configured" error and crashed the whole route via
          // React's error boundary, since only "localhost" was listed
          // here. When the configured site origin itself is one of these
          // loopback hosts, list every loopback variant (not just the one
          // literal configured hostname) so next/image accepts whichever
          // one the request actually arrives under, matching safe-url.ts's
          // own loopback-interchangeability rule exactly. A real
          // production hostname is never a loopback host, so this only
          // ever adds entries in dev/QA loopback setups -- production
          // keeps its single exact-hostname entry unchanged.
          remotePatterns: (["localhost", "127.0.0.1"].includes(siteOrigin.hostname)
            ? ["localhost", "127.0.0.1"]
            : [siteOrigin.hostname]
          ).map((hostname) => ({
            protocol: siteOrigin.protocol.replace(":", "") as "http" | "https",
            hostname,
            port: siteOrigin.port,
            pathname: "/media/**",
          })),
          // Next 16's SSRF guard blocks self-fetches that resolve to a
          // loopback/private IP by default. In this Docker Compose setup
          // the frontend's own site origin (NEXT_PUBLIC_SITE_URL) always
          // resolves to the container's own loopback address when the
          // optimizer fetches it server-side -- the exact "self-hosting on
          // a private network" case this flag documents, not attacker-
          // controlled input (remotePatterns above already restricts the
          // optimizer to this app's own "/media/**" path).
          dangerouslyAllowLocalIP: true,
        },
      }
    : {}),
};

export default nextConfig;
