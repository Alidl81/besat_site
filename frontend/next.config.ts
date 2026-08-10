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
};

export default nextConfig;
