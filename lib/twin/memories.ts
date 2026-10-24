import type { TwinMemoryEntry } from "@/lib/memory";
import type { ClosedTrade, TwinStats } from "@/lib/trades/stats";
import type { ValuedActivity, ValuedLeg } from "@/lib/trades/types";
import {
  formatAmount,
  formatDate,
  formatDateTime,
  formatDuration,
  formatUsd,
  shortType,
} from "@/lib/twin/format";

/** Activity kinds worth remembering as [trade] entries. */
const MEMORABLE_KINDS = new Set(["swap", "nft_buy", "nft_sell", "nft_mint", "stake", "unstake"]);

/** Max [trade] memories written per sync (relayer writes are slow and rate-limited). */
export const MAX_TRADE_MEMORIES_PER_SYNC = 150;

function legText(leg: ValuedLeg): string {
  return `${formatAmount(leg.amount)} ${leg.symbol ?? shortType(leg.coinType)}`;
}

function legsText(legs: ValuedLeg[]): string {
  return legs.length > 0 ? legs.map(legText).join(" + ") : "nothing";
}

export function describeActivity(activity: ValuedActivity, closed: ClosedTrade | undefined): string {
  const when = formatDateTime(activity.timestampMs);
  const value = activity.usdValue !== null ? ` (≈${formatUsd(activity.usdValue)})` : " (USD value unknown)";
  const via = activity.entrypoint ? ` via ${activity.entrypoint}` : "";
  const nfts = activity.nftTypes.map(shortType).join(", ");
  let body: string;
  switch (activity.kind) {
    case "swap":
      body = `swapped ${legsText(activity.legsOut)} for ${legsText(activity.legsIn)}${value}${via}`;
      break;
    case "nft_buy":
      body = `bought NFT ${nfts} for ${legsText(activity.legsOut)}${value}`;
      break;
    case "nft_sell":
      body = `sold NFT ${nfts} for ${legsText(activity.legsIn)}${value}`;
      break;
    case "nft_mint":
      body = `minted NFT ${nfts}`;
      break;
    case "stake":
      body = `staked SUI with a validator`;
      break;
    case "unstake":
      body = `withdrew staked SUI`;
      break;
    default:
      body = activity.kind.replace("_", " ");
  }
  const outcome = closed
    ? ` Outcome: closed ${closed.symbol ?? "position"} at ${formatUsd(closed.pnlUsd, { signed: true })} after holding ${formatDuration(closed.holdingMs)}.`
    : "";
  return `${when}: ${body}.${outcome} tx ${activity.digest}`;
}

/** [trade] entries for newly synced activity, newest first, capped. */
export function tradeMemories(activities: ValuedActivity[], stats: TwinStats): TwinMemoryEntry[] {
  const closedByDigest = new Map(stats.closed.map((trade) => [`${trade.digest}|${trade.coinType}`, trade]));
  return activities
    .filter((activity) => MEMORABLE_KINDS.has(activity.kind))
    .sort((a, b) => b.timestampMs - a.timestampMs)
    .slice(0, MAX_TRADE_MEMORIES_PER_SYNC)
    .map((activity) => {
      const closed = activity.legsOut
        .map((leg) => closedByDigest.get(`${activity.digest}|${leg.coinType}`))
        .find(Boolean);
      return { type: "trade" as const, key: `trade:${activity.digest}`, text: describeActivity(activity, closed) };
    });
}

/**
 * Deterministic [milestone] entries (firsts and records). Keys embed the record's
 * digest, so a new record becomes a new memory while an unchanged one is never rewritten.
 */
export function milestoneMemories(activities: ValuedActivity[], stats: TwinStats): TwinMemoryEntry[] {
  const ordered = [...activities].sort((a, b) => a.timestampMs - b.timestampMs);
  const entries: TwinMemoryEntry[] = [];
  const firstSwap = ordered.find((activity) => activity.kind === "swap");
  if (firstSwap) {
    entries.push({
      type: "milestone",
      key: `milestone:first-swap:${firstSwap.digest}`,
      text: `First swap on record (${formatDate(firstSwap.timestampMs)}): ${legsText(firstSwap.legsOut)} → ${legsText(firstSwap.legsIn)}.`,
    });
  }
  const firstNft = ordered.find((activity) => activity.kind === "nft_buy" || activity.kind === "nft_mint");
  if (firstNft) {
    entries.push({
      type: "milestone",
      key: `milestone:first-nft:${firstNft.digest}`,
      text: `First NFT on record (${formatDate(firstNft.timestampMs)}): ${firstNft.kind === "nft_mint" ? "minted" : "bought"} ${firstNft.nftTypes.map(shortType).join(", ")}.`,
    });
  }
  if (stats.biggestWin) {
    const win = stats.biggestWin;
    entries.push({
      type: "milestone",
      key: `milestone:biggest-win:${win.digest}`,
      text: `Biggest win: ${formatUsd(win.pnlUsd, { signed: true })} on ${win.symbol ?? shortType(win.coinType)} (closed ${formatDate(win.timestampMs)}, held ${formatDuration(win.holdingMs)}).`,
    });
  }
  if (stats.worstLoss) {
    const loss = stats.worstLoss;
    entries.push({
      type: "milestone",
      key: `milestone:worst-loss:${loss.digest}`,
      text: `Worst loss: ${formatUsd(loss.pnlUsd, { signed: true })} on ${loss.symbol ?? shortType(loss.coinType)} (closed ${formatDate(loss.timestampMs)}, held ${formatDuration(loss.holdingMs)}).`,
    });
  }
  const largest = ordered
    .filter((activity) => activity.kind === "swap" && activity.usdValue !== null)
    .sort((a, b) => b.usdValue! - a.usdValue!)[0];
  if (largest) {
    entries.push({
      type: "milestone",
      key: `milestone:largest-trade:${largest.digest}`,
      text: `Largest single trade: ${formatUsd(largest.usdValue)} (${legsText(largest.legsOut)} → ${legsText(largest.legsIn)}) on ${formatDate(largest.timestampMs)}.`,
    });
  }
  const swapMilestones = [10, 100, 500, 1000].filter((count) => stats.swapCount >= count);
  const topCount = swapMilestones.at(-1);
  if (topCount) {
    entries.push({ type: "milestone", key: `milestone:swaps:${topCount}`, text: `Passed ${topCount} swaps on record.` });
  }
  return entries;
}
