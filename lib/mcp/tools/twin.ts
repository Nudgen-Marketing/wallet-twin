import "server-only";
import { z } from "zod";
import { hasLanguageModel } from "@/lib/ai";
import { loadPortfolio } from "@/lib/copy/portfolio";
import { db } from "@/lib/db";
import { memoryBackendName, recallTwin, rememberTwin } from "@/lib/memory";
import { MEMORY_TYPES, memoryTypeOf } from "@/lib/memory/namespaces";
import { defineTool } from "@/lib/mcp/define";
import { hasScope, isSignedIn, type McpPrincipal, type SignedInPrincipal } from "@/lib/mcp/principal";
import { NO_LLM } from "@/lib/mcp/tools/public";
import { absoluteUrl, iso, NOTICE, statsSchema, statsView } from "@/lib/mcp/views";
import { getSyncStatus } from "@/lib/sync/status";
import type { ActivityKind, ValuedActivity, ValuedLeg } from "@/lib/trades/types";
import { askTwin } from "@/lib/twin/ask";
import { chatFactEntry } from "@/lib/twin/chat";
import { MAX_USER_MESSAGE_CHARS } from "@/lib/twin/chat-request";
import { loadTwinSnapshot } from "@/lib/twin/data";
import { isPublished } from "@/lib/twin/publish";
import { buildWrappedCard } from "@/lib/wrapped/data";
import { wrappedImagePath, wrappedSharePath } from "@/lib/wrapped/share";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
export const NOT_SYNCED = "This wallet hasn't been synced yet. Call start_sync first (needs the twin:sync permission).";
const HOUR_MS = 3_600_000;
const MIST_PER_SUI = 1e9;

/** Every tool below is gated on a scope, so the caller is always signed in. */
function owner(principal: McpPrincipal): SignedInPrincipal {
  if (!isSignedIn(principal)) throw new Error("Signed-in tool called without a wallet");
  return principal;
}

async function isSynced(address: string): Promise<boolean> {
  return (await db.syncState.count({ where: { address } })) > 0;
}

export const whoamiTool = defineTool({
  name: "whoami",
  title: "Who am I connected as",
  description: "The Sui wallet this connection acts for, its permissions, and whether its twin is synced and published.",
  access: "signed_in",
  input: z.object({}),
  output: z.object({
    address: z.string(),
    demo: z.boolean(),
    connection: z.enum(["oauth", "api_key"]),
    scopes: z.array(z.string()),
    synced: z.boolean(),
    lastSyncedAt: z.string().nullable(),
    published: z.boolean(),
    memoryBackend: z.enum(["walrus", "local"]),
    twinUrl: z.string(),
  }),
  annotations: READ_ONLY,
  run: async (_args, principal) => {
    const { address, demo, kind, scopes } = owner(principal);
    const [state, published] = await Promise.all([db.syncState.findUnique({ where: { address } }), isPublished(address)]);
    return {
      data: {
        address,
        demo,
        connection: kind === "api_key" ? ("api_key" as const) : ("oauth" as const),
        scopes: [...scopes],
        synced: state !== null,
        lastSyncedAt: state?.lastSyncedAt?.toISOString() ?? null,
        published,
        memoryBackend: memoryBackendName(),
        twinUrl: absoluteUrl(published ? `/twin/${address}` : "/twin/me"),
      },
      summary: `Connected as ${address}${demo ? " (shared demo wallet)" : ""}.`,
    };
  },
});

export const getMyStatsTool = defineTool({
  name: "get_my_stats",
  title: "My trading stats",
  description:
    "Aggregate stats and behavioral habits computed from the wallet's synced on-chain history: swaps, volume, " +
    `win rate, realized PnL, holding times, favorite tokens, PnL by token, busiest hours. ${NOTICE}`,
  access: "twin:read",
  input: z.object({}),
  output: z.object({
    address: z.string(),
    historyFrom: z.string().nullable(),
    stats: statsSchema,
    habits: z.object({
      swapsPerActiveDay: z.number().nullable(),
      busiestHourUtc: z.number().nullable(),
      busiestWeekday: z.string().nullable(),
      longTailShare: z.number().nullable().describe("Share of swaps in tokens outside SUI, majors and stables."),
      medianHoldingHours: z.number().nullable(),
      shortHoldShare: z.number().nullable().describe("Share of sold positions held under 2 days."),
      avgTradeUsd: z.number().nullable(),
      distinctTokens: z.number(),
      longestLosingStreak: z.number(),
      stableShareOfBuys: z.number().nullable(),
      pnlByToken: z.array(z.object({ symbol: z.string(), pnlUsd: z.number(), trades: z.number() })),
    }),
    notice: z.string(),
  }),
  annotations: READ_ONLY,
  run: async (_args, principal) => {
    const { address } = owner(principal);
    const state = await db.syncState.findUnique({ where: { address } });
    if (!state) return { error: NOT_SYNCED };
    const { stats, features } = await loadTwinSnapshot(address);
    return {
      data: {
        address,
        historyFrom: state.historyFromMs?.toISOString() ?? null,
        stats: statsView(stats),
        habits: {
          swapsPerActiveDay: features.swapsPerActiveDay,
          busiestHourUtc: features.busiestHourUtc,
          busiestWeekday: features.busiestWeekday,
          longTailShare: features.longTailShare,
          medianHoldingHours:
            features.medianHoldingMs === null ? null : Math.round((features.medianHoldingMs / HOUR_MS) * 10) / 10,
          shortHoldShare: features.shortHoldShare,
          avgTradeUsd: features.avgTradeUsd,
          distinctTokens: features.distinctTokens,
          longestLosingStreak: features.longestLosingStreak,
          stableShareOfBuys: features.stableShareOfBuys,
          pnlByToken: features.pnlByToken.slice(0, 15),
        },
        notice: NOTICE,
      },
      summary: `${stats.swapCount} swaps, ${stats.closedTrades} closed trades, realized PnL ≈ $${stats.realizedPnlUsd.toFixed(2)}.`,
    };
  },
});

const memorySchema = z.object({
  type: z.string().nullable(),
  text: z.string(),
  createdAt: z.string().nullable(),
  relevance: z.number().describe("0–1, higher is closer to the query."),
});

export const recallMyMemoriesTool = defineTool({
  name: "recall_my_memories",
  title: "Recall my twin's memories",
  description:
    "Semantic search over the twin's Walrus memories: [profile], [insight], [milestone], [trade] and the [chat] facts " +
    "the owner told it. Filter by type to narrow it down.",
  access: "twin:read",
  input: z.object({
    query: z.string().trim().min(1).max(500),
    types: z.array(z.enum(MEMORY_TYPES)).min(1).optional(),
    limit: z.number().int().min(1).max(20).default(8),
  }),
  output: z.object({ memories: z.array(memorySchema), backend: z.enum(["walrus", "local"]) }),
  annotations: { ...READ_ONLY, openWorldHint: true },
  run: async ({ query, types, limit }, principal) => {
    const { address } = owner(principal);
    const recalled = await recallTwin(address, query, { audience: "owner", types, limit });
    const memories = recalled.map((memory) => ({
      type: memoryTypeOf(memory.text),
      text: memory.text,
      createdAt: memory.createdAt,
      relevance: Math.round(Math.max(0, 1 - memory.distance) * 1000) / 1000,
    }));
    return { data: { memories, backend: memoryBackendName() }, summary: `${memories.length} memories recalled.` };
  },
});

const ACTIVITY_KINDS = [
  "swap",
  "transfer_in",
  "transfer_out",
  "deposit",
  "withdraw",
  "nft_buy",
  "nft_sell",
  "nft_mint",
  "nft_received",
  "nft_sent",
  "stake",
  "unstake",
  "other",
  "failed",
] as const satisfies readonly ActivityKind[];

const legSchema = z.object({
  symbol: z.string().nullable(),
  coinType: z.string(),
  amount: z.number().nullable(),
  usd: z.number().nullable(),
});

const activitySchema = z.object({
  digest: z.string(),
  at: z.string(),
  kind: z.string(),
  usdValue: z.number().nullable(),
  sold: z.array(legSchema),
  bought: z.array(legSchema),
  gasSui: z.number(),
  counterparty: z.string().nullable(),
  protocol: z.string().nullable(),
  explorerUrl: z.string(),
});

const legView = (leg: ValuedLeg) => ({ symbol: leg.symbol, coinType: leg.coinType, amount: leg.amount, usd: leg.usd });

function activityView(activity: ValuedActivity): z.infer<typeof activitySchema> {
  return {
    digest: activity.digest,
    at: new Date(activity.timestampMs).toISOString(),
    kind: activity.kind,
    usdValue: activity.usdValue,
    sold: activity.legsOut.map(legView),
    bought: activity.legsIn.map(legView),
    gasSui: Number(activity.gasMist) / MIST_PER_SUI,
    counterparty: activity.counterparty,
    protocol: activity.entrypoint,
    explorerUrl: `https://suiscan.xyz/mainnet/tx/${activity.digest}`,
  };
}

/** Opaque page cursor: the last row's timestamp and digest. */
const encodeCursor = (timestamp: Date, digest: string) =>
  Buffer.from(JSON.stringify([timestamp.getTime(), digest])).toString("base64url");

function decodeCursor(cursor: string): { timestamp: Date; digest: string } | null {
  try {
    const [ms, digest] = JSON.parse(Buffer.from(cursor, "base64url").toString()) as [unknown, unknown];
    return typeof ms === "number" && typeof digest === "string" ? { timestamp: new Date(ms), digest } : null;
  } catch {
    return null;
  }
}

export const listMyTradesTool = defineTool({
  name: "list_my_trades",
  title: "List my on-chain activity",
  description:
    "The wallet's classified on-chain activity, newest first: swaps (sold/bought legs with USD estimates), transfers, " +
    "staking and NFT actions. Page with nextCursor.",
  access: "twin:read",
  input: z.object({
    kind: z.enum(ACTIVITY_KINDS).optional(),
    since: z.iso.datetime({ offset: true }).optional().describe("Only activity at or after this ISO time."),
    limit: z.number().int().min(1).max(100).default(25),
    cursor: z.string().max(200).optional(),
  }),
  output: z.object({ activities: z.array(activitySchema), nextCursor: z.string().nullable() }),
  annotations: READ_ONLY,
  run: async ({ kind, since, limit, cursor }, principal) => {
    const { address } = owner(principal);
    if (!(await isSynced(address))) return { error: NOT_SYNCED };
    const after = cursor ? decodeCursor(cursor) : null;
    if (cursor && !after) return { error: "That cursor isn't valid. Start again without one." };
    const rows = await db.activity.findMany({
      where: {
        address,
        ...(kind ? { kind } : {}),
        ...(since ? { timestamp: { gte: new Date(since) } } : {}),
        ...(after
          ? {
              OR: [
                { timestamp: { lt: after.timestamp } },
                { timestamp: after.timestamp, digest: { lt: after.digest } },
              ],
            }
          : {}),
      },
      orderBy: [{ timestamp: "desc" }, { digest: "desc" }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const nextCursor = rows.length > limit && last ? encodeCursor(last.timestamp, last.digest) : null;
    // Rows are written only by our own sync from validated, typed values.
    const activities = page.map((row) => activityView(JSON.parse(row.data) as ValuedActivity));
    return { data: { activities, nextCursor }, summary: `${activities.length} activities${nextCursor ? ", more available" : ""}.` };
  },
});

export const getMyWrappedTool = defineTool({
  name: "get_my_wrapped",
  title: "My Wallet Wrapped",
  description: "The wallet's Wrapped card (stats and a one-liner) plus a share link and PNG image URL.",
  access: "twin:read",
  input: z.object({}),
  output: z.object({
    swaps: z.number(),
    winRate: z.number().nullable(),
    realizedPnlUsd: z.number().nullable(),
    favoriteToken: z.string().nullable(),
    avgHoldingHours: z.number().nullable(),
    biggestWin: z.object({ symbol: z.string(), pnlUsd: z.number() }).nullable(),
    from: z.string().nullable(),
    to: z.string().nullable(),
    line: z.string(),
    shareUrl: z.string(),
    imageUrl: z.string(),
  }),
  annotations: READ_ONLY,
  run: async (_args, principal) => {
    const { address } = owner(principal);
    if (!(await isSynced(address))) return { error: NOT_SYNCED };
    const card = await buildWrappedCard(address);
    return {
      data: {
        swaps: card.swaps,
        winRate: card.winRate,
        realizedPnlUsd: card.realizedPnlUsd,
        favoriteToken: card.favoriteToken,
        avgHoldingHours: card.avgHoldingMs === null ? null : Math.round((card.avgHoldingMs / HOUR_MS) * 10) / 10,
        biggestWin: card.biggestWin,
        from: iso(card.fromMs),
        to: iso(card.toMs),
        line: card.line,
        shareUrl: absoluteUrl(wrappedSharePath(address)),
        imageUrl: absoluteUrl(wrappedImagePath(address)),
      },
      summary: card.line,
    };
  },
});

export const getSyncStatusTool = defineTool({
  name: "get_sync_status",
  title: "Sync status",
  description: "Progress of the latest sync (Tatum history → pricing → profile → Walrus memories) and memory write counts.",
  access: "twin:read",
  input: z.object({}),
  output: z.object({
    run: z
      .object({
        id: z.string(),
        status: z.enum(["running", "done", "failed"]),
        stage: z.string(),
        progress: z.record(z.string(), z.unknown()),
        error: z.string().nullable(),
        startedAt: z.string(),
        finishedAt: z.string().nullable(),
      })
      .nullable(),
    memory: z.object({ pending: z.number(), done: z.number(), failed: z.number(), backend: z.enum(["walrus", "local"]) }),
    lastSyncedAt: z.string().nullable(),
    historyFrom: z.string().nullable(),
  }),
  annotations: { ...READ_ONLY, idempotentHint: false },
  run: async (_args, principal) => {
    const status = await getSyncStatus(owner(principal).address);
    const summary = status.run
      ? `Latest sync ${status.run.status} (stage: ${status.run.stage}).`
      : "Never synced. Call start_sync.";
    return { data: { ...status, run: status.run && { ...status.run, progress: { ...status.run.progress } } }, summary };
  },
});

export const getPaperPortfolioTool = defineTool({
  name: "get_paper_portfolio",
  title: "My paper portfolios",
  description:
    "SIMULATED paper-copy portfolios ($1,000 of paper money each): value, PnL, holdings, recent copied trades, and the " +
    "simulated fee the leader would have earned. No real funds.",
  access: "twin:read",
  input: z.object({}),
  output: z.object({
    follows: z.array(
      z.object({
        leader: z.string(),
        leaderIsPublic: z.boolean(),
        startedAt: z.string(),
        lastPolledAt: z.string().nullable(),
        startingUsd: z.number(),
        valueUsd: z.number(),
        pnlUsd: z.number(),
        pnlPct: z.number(),
        cashUsd: z.number(),
        holdings: z.array(z.object({ symbol: z.string(), units: z.number(), valueUsd: z.number() })),
        filled: z.number(),
        skipped: z.number(),
        copiedVolumeUsd: z.number(),
        feesUsd: z.number(),
        leaderEarnedUsd: z.number(),
        recentTrades: z.array(
          z.object({ digest: z.string(), at: z.string(), status: z.string(), summary: z.string(), volumeUsd: z.number().nullable() }),
        ),
      }),
    ),
    notice: z.string(),
  }),
  annotations: READ_ONLY,
  run: async (_args, principal) => {
    const portfolios = await loadPortfolio(owner(principal).address);
    const follows = portfolios.map((follow) => ({
      leader: follow.leader,
      leaderIsPublic: follow.leaderIsPublic,
      startedAt: follow.startedAt.toISOString(),
      lastPolledAt: follow.lastPolledAt?.toISOString() ?? null,
      startingUsd: follow.startingUsd,
      valueUsd: follow.valueUsd,
      pnlUsd: follow.pnlUsd,
      pnlPct: follow.pnlPct,
      cashUsd: follow.cashUsd,
      holdings: follow.holdings,
      filled: follow.filled,
      skipped: follow.skipped,
      copiedVolumeUsd: follow.copiedVolumeUsd,
      feesUsd: follow.feesUsd,
      leaderEarnedUsd: follow.leaderEarnedUsd,
      recentTrades: follow.recentTrades.map((trade) => ({
        digest: trade.digest,
        at: new Date(trade.timestampMs).toISOString(),
        status: trade.status,
        summary: trade.summary,
        volumeUsd: trade.volumeUsd,
      })),
    }));
    return {
      data: { follows, notice: NOTICE },
      summary: follows.length === 0 ? "No paper portfolios yet." : `${follows.length} paper portfolio(s), simulated.`,
    };
  },
});

export const askMyTwinTool = defineTool({
  name: "ask_my_twin",
  title: "Ask my twin",
  description:
    "Ask the wallet's own twin a question. It answers in first person, grounded in its stats and recalled memories " +
    "(including private [trade] and [chat] memories). With the twin:remember permission, facts the owner states are " +
    `saved to Walrus. ${NOTICE}`,
  access: "twin:chat",
  bucket: "ask",
  input: z.object({
    question: z.string().trim().min(1).max(MAX_USER_MESSAGE_CHARS),
    history: z
      .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(MAX_USER_MESSAGE_CHARS) }))
      .max(10)
      .optional()
      .describe("Earlier turns of this conversation, oldest first."),
  }),
  output: z.object({ answer: z.string(), factsSaved: z.boolean(), notice: z.string() }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  run: async ({ question, history }, principal) => {
    if (!hasLanguageModel()) return { error: NO_LLM };
    const me = owner(principal);
    if (!(await isSynced(me.address))) return { error: NOT_SYNCED };
    const saveFacts = hasScope(me, "twin:remember") && !me.demo;
    const answer = await askTwin({ address: me.address, audience: "owner", question, history, saveFacts });
    return { data: { answer, factsSaved: saveFacts, notice: NOTICE }, summary: answer };
  },
});

export const rememberFactTool = defineTool({
  name: "remember_fact",
  title: "Teach my twin a fact",
  description:
    "Save something the owner said about themselves (goals, constraints, context) as a private [chat] memory on " +
    "Walrus. Only facts the owner actually stated; never store secrets such as keys or seed phrases.",
  access: "twin:remember",
  input: z.object({ fact: z.string().trim().min(3).max(300) }),
  output: z.object({ saved: z.boolean(), alreadyKnown: z.boolean(), backend: z.enum(["walrus", "local"]) }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  run: async ({ fact }, principal) => {
    const me = owner(principal);
    if (me.demo) return { error: "Demo twins are shared, so they don't save anything." };
    const outcome = await rememberTwin(me.address, [chatFactEntry(fact)]);
    if (outcome.failed > 0) return { error: "Walrus Memory didn't accept that fact. Try again shortly." };
    return {
      data: { saved: outcome.submitted > 0, alreadyKnown: outcome.skipped > 0, backend: memoryBackendName() },
      summary: outcome.skipped > 0 ? "Your twin already knew that." : "Saved to your twin's private memory.",
    };
  },
});

export const TWIN_TOOLS = [
  whoamiTool,
  getMyStatsTool,
  recallMyMemoriesTool,
  listMyTradesTool,
  getMyWrappedTool,
  getSyncStatusTool,
  getPaperPortfolioTool,
  askMyTwinTool,
  rememberFactTool,
];
