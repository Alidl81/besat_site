import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.10.65", "192.168.10.71"],
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": ["./data/mock-database.seed.json"],
  },
};

export default nextConfig;
