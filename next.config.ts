import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page in this app is per-user and dynamic, so Cache Components is off.
  // See DECISIONS.md (2026-10-28).
  cacheComponents: false,
  turbopack: {
    // Known and handled by outputFileTracingExcludes above.
    ignoreIssue: [{ path: "**/src/lib/llm/mock.ts" }],
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
  // The mock LLM provider reads fixture files from dynamic paths, which makes
  // the tracer treat the whole project as reachable. Nothing below is needed
  // at runtime, so it never ships in a deployment.
  outputFileTracingExcludes: {
    "*": ["./tests/**/*", "./docs/**/*", "./templates/**/*", "./drizzle/**/*", "./scripts/**/*", "./.github/**/*"],
  },
};

export default nextConfig;
