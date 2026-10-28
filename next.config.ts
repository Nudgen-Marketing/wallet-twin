import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E runs set NEXT_DIST_DIR so their dev server never shares a build cache with `pnpm dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        // The OAuth consent screen must never be framed (clickjacking an "Allow" click).
        source: "/oauth/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          // same-origin, not no-referrer: no-referrer makes the consent POST send `Origin: null`.
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
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
