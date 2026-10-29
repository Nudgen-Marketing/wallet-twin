import { ImageResponse } from "next/og";
import { SiteCardImage } from "@/components/og/SiteCardImage";
import { CARD_SIZE } from "@/components/og/primitives";
import { SITE, siteUrl } from "@/lib/seo/site";
import { loadCardFonts } from "@/lib/wrapped/fonts";

export const alt = SITE.imageAlt;
export const size = CARD_SIZE;
export const contentType = "image/png";

/** Default link preview for every page that doesn't render its own. */
export default async function OpenGraphImage() {
  return new ImageResponse(<SiteCardImage host={siteUrl().host} />, {
    ...size,
    fonts: await loadCardFonts(),
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
