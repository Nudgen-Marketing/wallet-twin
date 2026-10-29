import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { absoluteUrl } from "@/lib/seo/site";
import { listPublishedTwins } from "@/lib/seo/twin";

/** Public pages plus every published twin. Owner-only pages are left out (they're `noindex`). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Twins are published at runtime, so read the database per request instead of at build.
  await connection();
  const twins = await listPublishedTwins();
  const boardUpdated = twins[0]?.lastModified;

  return [
    { url: absoluteUrl("/"), lastModified: boardUpdated, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/leaderboard"), lastModified: boardUpdated, changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/connect"), changeFrequency: "monthly", priority: 0.6 },
    ...twins.map((twin) => ({
      url: absoluteUrl(`/twin/${twin.address}`),
      lastModified: twin.lastModified,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
