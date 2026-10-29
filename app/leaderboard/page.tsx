import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { absoluteUrl, pageMetadata, serializeJsonLd } from "@/lib/seo/site";
import { twinTitle } from "@/lib/seo/twin";
import { getLeaderboard, type LeaderboardRow } from "@/lib/twin/publish";

const TITLE = "Leaderboard: top public Sui wallet twins";
const DESCRIPTION =
  "Published Sui wallet twins ranked by the return of a simulated $1,000 paper copy, then win rate and realized PnL. Open any twin to chat with it.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/leaderboard" });

export default function LeaderboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
      <p className="kicker">Leaderboard</p>
      <h1 className="mt-3 fringe font-display text-5xl font-bold uppercase tracking-tight sm:text-6xl">Public twins</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-soft">
        Wallets whose owners chose to publish their twin. Ranked by the simulated return of a $1,000 paper copy
        portfolio, then win rate and realized PnL. Twins with fewer than 3 closed trades rank last.
      </p>
      <Suspense fallback={<p className="mt-8 text-ink-soft">Loading the board…</p>}>
        <Board />
      </Suspense>
    </main>
  );
}

async function Board() {
  await connection();
  const rows = await getLeaderboard();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(rankingJsonLd(rows)) }} />
      <LeaderboardTable rows={rows} />
    </>
  );
}

/** The ranking as a schema.org ItemList, so answer engines can cite and link each twin. */
function rankingJsonLd(rows: LeaderboardRow[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: TITLE,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: rows.length,
    itemListElement: rows.map((row) => ({
      "@type": "ListItem",
      position: row.rank,
      name: twinTitle(row.address),
      url: absoluteUrl(`/twin/${row.address}`),
    })),
  };
}
