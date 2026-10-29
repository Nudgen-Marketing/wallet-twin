import { ImageResponse } from "next/og";
import { SiteCardImage } from "@/components/og/SiteCardImage";
import { TwinCardImage } from "@/components/og/TwinCardImage";
import { CARD_SIZE } from "@/components/og/primitives";
import { parseSuiAddress } from "@/lib/auth/message";
import { siteUrl } from "@/lib/seo/site";
import { loadTwinSeo } from "@/lib/seo/twin";
import { loadCardFonts } from "@/lib/wrapped/fonts";

export const alt = "A WalletTwin public twin: its trading headline, swaps, win rate, realized PnL and paper copy return";
export const size = CARD_SIZE;
export const contentType = "image/png";

/** A published twin's link preview, from the leaderboard row (never Walrus, so it stays fast). */
export default async function TwinOpenGraphImage({ params }: { params: Promise<{ address: string }> }) {
  const address = parseSuiAddress((await params).address);
  const [twin, fonts] = await Promise.all([address ? loadTwinSeo(address) : null, loadCardFonts()]);
  const host = siteUrl().host;
  // Unpublished or invalid: the generic card, so a private wallet's numbers never leak.
  const card = twin ? <TwinCardImage twin={twin} host={host} /> : <SiteCardImage host={host} />;
  return new ImageResponse(card, {
    ...size,
    fonts,
    headers: { "Cache-Control": "public, max-age=600, s-maxage=600" },
  });
}
