import { connection } from "next/server";
import { fail, ok } from "@/lib/http/api";
import { spotPrices } from "@/lib/market/spot";

export async function GET() {
  // Live data: never prerender this at build time.
  await connection();
  try {
    return ok(await spotPrices.get(), {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
    });
  } catch (error: unknown) {
    console.error("[prices] spot fetch failed", error instanceof Error ? error.message : error);
    return fail("Prices are offline right now.", 502);
  }
}
