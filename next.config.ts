import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page in this app is per-user and dynamic, so Cache Components is off.
  // See DECISIONS.md (2026-10-28).
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
};

export default nextConfig;
