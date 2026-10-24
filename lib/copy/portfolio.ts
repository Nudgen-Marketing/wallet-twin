import "server-only";
import { db } from "@/lib/db";
import { feeSplit, type PaperState, portfolioValueUsd, QUOTE_COINS } from "@/lib/copy/engine";
import { shortType } from "@/lib/twin/format";

export interface PaperHolding {
  symbol: string;
  units: number;
  valueUsd: number;
}

export interface PaperTradeView {
  digest: string;
  timestampMs: number;
  status: "filled" | "skipped";
  summary: string;
  volumeUsd: number | null;
  feeUsd: number | null;
}

export interface FollowView {
  leader: string;
  leaderIsPublic: boolean;
  startedAt: Date;
  lastPolledAt: Date | null;
  startingUsd: number;
  valueUsd: number;
  pnlUsd: number;
  pnlPct: number;
  cashUsd: number;
  holdings: PaperHolding[];
  filled: number;
  skipped: number;
  copiedVolumeUsd: number;
  feesUsd: number;
  leaderEarnedUsd: number;
  platformEarnedUsd: number;
  recentTrades: PaperTradeView[];
}

const symbolOf = (state: PaperState, coinType: string | null) =>
  coinType ? (state.symbols[coinType] ?? shortType(coinType)) : "?";

function describeTrade(
  state: PaperState,
  trade: { status: string; reason: string | null; soldCoin: string | null; boughtCoin: string | null; boughtAmount: number | null },
): string {
  if (trade.status !== "filled") return `Skipped: ${trade.reason ?? "not copyable"}`;
  const bought = symbolOf(state, trade.boughtCoin);
  const sold = symbolOf(state, trade.soldCoin);
  const amount = trade.boughtAmount?.toLocaleString("en-US", { maximumFractionDigits: 4 }) ?? "?";
  if (trade.boughtCoin && QUOTE_COINS.has(trade.boughtCoin)) return `Sold ${sold} for $${amount} paper cash`;
  return `Bought ${amount} ${bought} with ${trade.soldCoin && QUOTE_COINS.has(trade.soldCoin) ? "paper cash" : sold}`;
}

export async function loadPortfolio(follower: string): Promise<FollowView[]> {
  const follows = await db.follow.findMany({ where: { follower, active: true }, orderBy: { startedAt: "asc" } });
  const published = new Set(
    (await db.publicTwin.findMany({ where: { address: { in: follows.map((f) => f.leader) } }, select: { address: true } })).map(
      (row) => row.address,
    ),
  );

  return Promise.all(
    follows.map(async (follow) => {
      const state = JSON.parse(follow.state) as PaperState;
      const trades = await db.paperTrade.findMany({
        where: { followId: follow.id },
        orderBy: { timestamp: "desc" },
        take: 10,
      });
      const valueUsd = portfolioValueUsd(state);
      const fees = feeSplit(state.feesUsd);
      const holdings = Object.entries(state.positions)
        .map(([coinType, units]) => ({
          symbol: symbolOf(state, coinType),
          units,
          valueUsd: units * (state.lastPriceUsd[coinType] ?? 0),
        }))
        .sort((a, b) => b.valueUsd - a.valueUsd);
      return {
        leader: follow.leader,
        leaderIsPublic: published.has(follow.leader),
        startedAt: follow.startedAt,
        lastPolledAt: follow.lastPolledAt,
        startingUsd: follow.startingUsd,
        valueUsd,
        pnlUsd: valueUsd - follow.startingUsd,
        pnlPct: ((valueUsd - follow.startingUsd) / follow.startingUsd) * 100,
        cashUsd: state.cashUsd,
        holdings,
        filled: state.filled,
        skipped: state.skipped,
        copiedVolumeUsd: state.copiedVolumeUsd,
        feesUsd: state.feesUsd,
        leaderEarnedUsd: fees.leaderUsd,
        platformEarnedUsd: fees.platformUsd,
        recentTrades: trades.map((trade) => ({
          digest: trade.digest,
          timestampMs: trade.timestamp.getTime(),
          status: trade.status as "filled" | "skipped",
          summary: describeTrade(state, trade),
          volumeUsd: trade.volumeUsd,
          feeUsd: trade.feeUsd,
        })),
      };
    }),
  );
}
