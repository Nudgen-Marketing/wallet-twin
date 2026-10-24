/**
 * Runs the real pipeline (Tatum history → parse → cached prices → stats) for one wallet.
 *   pnpm analyze <address> [maxTransactions=300] [priceBudget=60]
 */
import { getAddressHistory } from "@/lib/tatum";
import { analyzeTransactions } from "@/lib/trades/analyze";
import { computeStats } from "@/lib/trades/stats";

const usd = (value: number | null) => (value === null ? "—" : `$${value.toFixed(2)}`);
const hours = (ms: number | null) => (ms === null ? "—" : `${(ms / 3_600_000).toFixed(1)}h`);

async function main(): Promise<void> {
  const [address, maxArg = "300", budgetArg = "60"] = process.argv.slice(2);
  if (!address) throw new Error("usage: pnpm analyze <address> [maxTransactions] [priceBudget]");

  const history = await getAddressHistory(address, {
    maxTransactions: Number(maxArg),
    onPage: ({ fetched, pages }) => process.stdout.write(`\r  fetched ${fetched} tx (${pages} pages)`),
  });
  process.stdout.write(`\n  capped: ${history.hitCap}\n`);

  const { activities, pricesFetched, pricesSkipped } = await analyzeTransactions(address, history.transactions, {
    priceBudget: Number(budgetArg),
  });
  const stats = computeStats(activities);

  const lines = [
    `activities      ${activities.length}  ${JSON.stringify(stats.activityCounts)}`,
    `swaps           ${stats.swapCount} (${stats.pricedSwapCount} priced, volume ${usd(stats.tradedVolumeUsd)})`,
    `closed trades   ${stats.closedTrades}, win rate ${stats.winRate === null ? "—" : `${(stats.winRate * 100).toFixed(0)}%`}`,
    `realized PnL    ${usd(stats.realizedPnlUsd)}  (estimate)`,
    `avg holding     ${hours(stats.avgHoldingMs)}`,
    `favorites       ${stats.favoriteTokens.map((t) => `${t.symbol ?? "?"}×${t.trades}`).join(", ")}`,
    `biggest win     ${stats.biggestWin ? `${stats.biggestWin.symbol} ${usd(stats.biggestWin.pnlUsd)}` : "—"}`,
    `worst loss      ${stats.worstLoss ? `${stats.worstLoss.symbol} ${usd(stats.worstLoss.pnlUsd)}` : "—"}`,
    `window          ${stats.firstActivityMs ? new Date(stats.firstActivityMs).toISOString() : "—"} → ${stats.lastActivityMs ? new Date(stats.lastActivityMs).toISOString() : "—"}`,
    `prices          ${pricesFetched} fetched from Tatum, ${pricesSkipped} skipped (budget)`,
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
