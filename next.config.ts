import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E runs set NEXT_DIST_DIR so their dev server never shares a build cache with `pnpm dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
