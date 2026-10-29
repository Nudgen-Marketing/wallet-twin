import "server-only";
import { formatAddress } from "@mysten/sui/utils";
import { db } from "@/lib/db";
import { formatPercent, formatUsd } from "@/lib/twin/format";

/** What a published twin's metadata and preview card show. Database only: never waits on Walrus. */
export interface TwinSeo {
  address: string;
  updatedAt: Date;
  headline: string | null;
  swaps: number | null;
  winRate: number | null;
  realizedPnlUsd: number | null;
  copyReturnPct: number | null;
}

const MAX_DESCRIPTION = 200;

export async function loadTwinSeo(address: string): Promise<TwinSeo | null> {
  const [published, entry] = await Promise.all([
    db.publicTwin.findUnique({ where: { address } }),
    db.leaderboardEntry.findUnique({ where: { address } }),
  ]);
  if (!published) return null;
  return {
    address,
    updatedAt: entry?.updatedAt ?? published.publishedAt,
    headline: entry?.headline ?? null,
    swaps: entry?.swaps ?? null,
    winRate: entry?.winRate ?? null,
    realizedPnlUsd: entry?.realizedPnlUsd ?? null,
    copyReturnPct: entry?.copyReturnPct ?? null,
  };
}

/** Published twins for the sitemap, newest first. */
export async function listPublishedTwins(): Promise<{ address: string; lastModified: Date }[]> {
  const [published, entries] = await Promise.all([
    db.publicTwin.findMany({ select: { address: true, publishedAt: true } }),
    db.leaderboardEntry.findMany({ select: { address: true, updatedAt: true } }),
  ]);
  const updatedAt = new Map(entries.map((entry) => [entry.address, entry.updatedAt]));
  return published
    .map((twin) => ({ address: twin.address, lastModified: updatedAt.get(twin.address) ?? twin.publishedAt }))
    .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
}

export function twinTitle(address: string): string {
  return `Twin of ${formatAddress(address)}`;
}

/** One search-snippet-sized line: the twin's own headline, then its numbers. */
export function describeTwin(twin: TwinSeo): string {
  const facts = [
    twin.swaps === null ? null : `${twin.swaps.toLocaleString("en-US")} swaps`,
    twin.winRate === null ? null : `${formatPercent(twin.winRate)} win rate`,
    twin.realizedPnlUsd === null ? null : `${formatUsd(twin.realizedPnlUsd, { signed: true })} realized PnL`,
  ].filter((fact): fact is string => fact !== null);
  const stats = facts.length > 0 ? `${facts.join(", ")} on Sui.` : "Trading history on Sui.";
  const text = [twin.headline, stats, "Chat with this wallet's AI twin."].filter(Boolean).join(" ");
  return text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…` : text;
}
