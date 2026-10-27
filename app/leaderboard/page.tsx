import { connection } from "next/server";
import { Suspense } from "react";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { getLeaderboard } from "@/lib/twin/publish";

export default function LeaderboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
      <p className="kicker">Leaderboard</p>
      <h1 className="mt-3 fringe font-display text-5xl font-bold uppercase tracking-tight sm:text-6xl">Public twins</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-soft">
        Wallets whose owners chose to publish their twin. Ranked by the simulated return of a $1,000 paper copy
        portfolio, then win rate and realized PnL. Twins with fewer than 3 closed trades rank last. All figures are
        estimates; copy trading is <strong className="text-ink">simulated</strong>.
      </p>
      <Suspense fallback={<p className="mt-8 text-ink-soft">Loading the board…</p>}>
        <Board />
      </Suspense>
    </main>
  );
}

async function Board() {
  await connection();
  return <LeaderboardTable rows={await getLeaderboard()} />;
}
