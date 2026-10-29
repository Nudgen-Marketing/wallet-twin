import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo/site";

/** Web app manifest: install prompts, home-screen icons and the browser UI colour. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: SITE.backgroundColor,
    theme_color: SITE.backgroundColor,
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
