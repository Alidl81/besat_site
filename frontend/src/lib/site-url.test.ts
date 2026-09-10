import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

async function resolveProduction(value: string) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SITE_URL", value);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://decoy.example");
  const { resolveSiteUrl } = await import("@/lib/site-url");
  return resolveSiteUrl();
}

// OPS-FE-SITE-URL-RUNTIME-HOST-001: resolveSiteUrl() checked URL parsing,
// https://, and bare-origin shape, but never the *host* -- a loopback,
// private, metadata, or unedited-placeholder SITE_URL sailed straight
// through in production and got served in robots.txt/sitemap.xml/
// canonical/OG/JSON-LD output.
describe("production runtime SITE_URL host fail-closed contract", () => {
  it.each([
    "https://localhost",
    "https://127.0.0.1",
    "https://10.0.0.5",
    "https://169.254.169.254",
    "https://besat.example.com",
    "https://example.com.",
    "https://localhost..",
  ])("rejects unsafe runtime SITE_URL %j before metadata output", async (value) => {
    await expect(resolveProduction(value)).rejects.toThrow(/OPS-FE-SITE-URL-RUNTIME-HOST-001/);
  });

  it("accepts the documented public origin", async () => {
    await expect(resolveProduction("https://besat.org/")).resolves.toBe("https://besat.org");
  });
});
