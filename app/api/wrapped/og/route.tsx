import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { WRAPPED_SIZE, WrappedCardImage } from "@/components/wrapped/WrappedCardImage";
import { parseSuiAddress } from "@/lib/auth/message";
import { fail } from "@/lib/http/api";
import { buildWrappedCard } from "@/lib/wrapped/data";
import { loadCardFonts } from "@/lib/wrapped/fonts";
import { isValidWrappedToken } from "@/lib/wrapped/share";

/** PNG Wrapped card. Needs the owner-issued share token, not a session, so X can fetch it. */
export async function GET(request: NextRequest) {
  const address = parseSuiAddress(request.nextUrl.searchParams.get("a") ?? "");
  if (!address || !isValidWrappedToken(address, request.nextUrl.searchParams.get("t"))) {
    return fail("Not found", 404);
  }

  const [card, fonts] = await Promise.all([buildWrappedCard(address), loadCardFonts()]);

  return new ImageResponse(<WrappedCardImage card={card} />, {
    ...WRAPPED_SIZE,
    fonts,
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
