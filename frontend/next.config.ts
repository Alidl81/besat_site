import type { NextConfig } from "next";

const requestedDistDir = process.env.BESAT_NEXT_DIST_DIR;
const distDir =
  requestedDistDir && /^\.next(?:[-_a-zA-Z0-9]+)?$/.test(requestedDistDir)
    ? requestedDistDir
    : ".next";
const requestedTypeScriptConfig = process.env.BESAT_NEXT_TSCONFIG_PATH;
const typeScriptConfigPath =
  requestedTypeScriptConfig &&
  /^\.next-playwright-[a-zA-Z0-9-]+\.tsconfig\.json$/.test(requestedTypeScriptConfig)
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

const nextConfig: NextConfig = {
  // Browser test servers use a project-local isolated build directory so they
  // never contend with a developer's active `.next` lock.
  distDir,
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
          remotePatterns: [
            {
              protocol: siteOrigin.protocol.replace(":", "") as "http" | "https",
              hostname: siteOrigin.hostname,
              port: siteOrigin.port,
              pathname: "/media/**",
            },
          ],
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
