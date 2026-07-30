import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.10.65", "192.168.10.71"],
  skipTrailingSlashRedirect: true,
  outputFileTracingIncludes: {
    "/*": ["./data/mock-database.seed.json"],
  },
};

export default nextConfig;
