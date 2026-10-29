import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * Crawl rules. Owner-only pages stay crawlable so engines can read their `noindex`; only
 * machine endpoints are blocked. The Wrapped card image stays open so X and others can
 * render shared cards. AI crawlers get the same rules as everyone, and /llms.txt guides them.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/wrapped/og"],
        disallow: ["/api/", "/oauth/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
