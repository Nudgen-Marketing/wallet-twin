import "server-only";
import { z } from "zod";
import { hasLanguageModel } from "@/lib/ai";
import { parseSuiAddress } from "@/lib/auth/message";
import { demoWallets } from "@/lib/demo";
import { defineTool } from "@/lib/mcp/define";
import { absoluteUrl, addressInput, iso, NOTICE, statsSchema, statsView } from "@/lib/mcp/views";
import { MAX_USER_MESSAGE_CHARS } from "@/lib/twin/chat-request";
import { askTwin } from "@/lib/twin/ask";
import { loadPublicTwin } from "@/lib/twin/public";
import { getLeaderboard, isPublished } from "@/lib/twin/publish";

export const NOT_PUBLIC = "That twin isn't public. Use get_leaderboard or list_demo_twins to find published twins.";
export const NO_LLM = "Twin chat isn't configured on this WalletTwin server.";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const twinRowSchema = z.object({
  rank: z.number(),
  address: z.string(),
  headline: z.string().nullable(),
  swaps: z.number(),
  closedTrades: z.number(),
  winRate: z.number().nullable(),
  realizedPnlUsd: z.number(),
  volumeUsd: z.number(),
  copyReturnPct: z.number().nullable().describe("Simulated return of a $1,000 paper copy over the twin's history."),
  favoriteToken: z.string().nullable(),
  url: z.string(),
});

export const getLeaderboardTool = defineTool({
  name: "get_leaderboard",
  title: "WalletTwin leaderboard",
  description:
    "Published Sui wallet twins ranked by simulated copy return, then win rate, then realized PnL. " +
    `Use an address with get_public_twin or ask_public_twin. ${NOTICE}`,
  access: "public",
  input: z.object({ limit: z.number().int().min(1).max(50).default(10) }),
  output: z.object({ twins: z.array(twinRowSchema), notice: z.string() }),
  annotations: READ_ONLY,
  run: async ({ limit }) => {
    const rows = await getLeaderboard(limit);
    return {
      data: { twins: rows.map((row) => ({ ...row, url: absoluteUrl(`/twin/${row.address}`) })), notice: NOTICE },
      summary: `${rows.length} published twins, best first.`,
    };
  },
});

export const listDemoTwinsTool = defineTool({
  name: "list_demo_twins",
  title: "Demo twins",
  description: "Real Sui mainnet wallets seeded as public demo twins, handy for trying the other public tools.",
  access: "public",
  input: z.object({}),
  output: z.object({ twins: z.array(z.object({ address: z.string(), label: z.string(), url: z.string() })) }),
  annotations: READ_ONLY,
  run: async () => {
    const twins = demoWallets().map((wallet) => ({ ...wallet, url: absoluteUrl(`/twin/${wallet.address}`) }));
    return { data: { twins }, summary: `${twins.length} demo twins.` };
  },
});

const publicTwinSchema = z.object({
  address: z.string(),
  publishedAt: z.string(),
  historyFrom: z.string().nullable(),
  profile: z.string().nullable(),
  insights: z.array(z.string()),
  milestones: z.array(z.string()),
  stats: statsSchema,
  url: z.string(),
  notice: z.string(),
});
export type PublicTwinData = z.infer<typeof publicTwinSchema>;

/** The public view of a published twin, or null when the address isn't published. */
export async function publicTwinData(input: string): Promise<PublicTwinData | null> {
  const address = parseSuiAddress(input);
  const view = address ? await loadPublicTwin(address) : null;
  if (!view) return null;
  return {
    address: view.address,
    publishedAt: view.publishedAt.toISOString(),
    historyFrom: iso(view.historyFromMs),
    profile: view.profile,
    insights: view.insights,
    milestones: view.milestones,
    stats: statsView(view.stats),
    url: absoluteUrl(`/twin/${view.address}`),
    notice: NOTICE,
  };
}

export const getPublicTwinTool = defineTool({
  name: "get_public_twin",
  title: "Public twin profile",
  description:
    "A published twin's trading profile, data-backed insights, milestones and aggregate stats. " +
    `Never includes the owner's private chat facts or individual trades. ${NOTICE}`,
  access: "public",
  input: z.object({ address: addressInput }),
  output: publicTwinSchema,
  annotations: READ_ONLY,
  run: async ({ address }) => {
    const data = await publicTwinData(address);
    if (!data) return { error: NOT_PUBLIC };
    return { data, summary: data.profile ?? "Published twin (no profile written yet)." };
  },
});

export const askPublicTwinTool = defineTool({
  name: "ask_public_twin",
  title: "Ask a public twin",
  description:
    "Ask a published twin a question. It answers in first person from its public profile, insights, milestones " +
    `and stats only. Nothing you ask is saved. ${NOTICE}`,
  access: "public",
  bucket: "ask",
  input: z.object({
    address: addressInput,
    question: z.string().trim().min(1).max(MAX_USER_MESSAGE_CHARS),
  }),
  output: z.object({ address: z.string(), answer: z.string(), notice: z.string() }),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  run: async ({ address: input, question }) => {
    if (!hasLanguageModel()) return { error: NO_LLM };
    const address = parseSuiAddress(input);
    if (!address || !(await isPublished(address))) return { error: NOT_PUBLIC };
    const answer = await askTwin({ address, audience: "public", question });
    return { data: { address, answer, notice: NOTICE }, summary: answer };
  },
});

export const PUBLIC_TOOLS = [getLeaderboardTool, listDemoTwinsTool, getPublicTwinTool, askPublicTwinTool];
