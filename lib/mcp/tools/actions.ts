import "server-only";
import { after } from "next/server";
import { z } from "zod";
import { parseSuiAddress } from "@/lib/auth/message";
import { CopyError, followLeader, MAX_FOLLOWS, pollFollows, unfollowLeader } from "@/lib/copy/service";
import { defineTool } from "@/lib/mcp/define";
import { isSignedIn, type McpPrincipal, type SignedInPrincipal } from "@/lib/mcp/principal";
import { absoluteUrl, addressInput, NOTICE } from "@/lib/mcp/views";
import { runSync, startSyncRun } from "@/lib/sync/run";
import { setPublished, TwinActionError } from "@/lib/twin/actions";

function owner(principal: McpPrincipal): SignedInPrincipal {
  if (!isSignedIn(principal)) throw new Error("Signed-in tool called without a wallet");
  return principal;
}

/** Turns a rule the user broke into a tool error; anything else is unexpected. */
function asUserError(error: unknown): { error: string } {
  if (error instanceof CopyError || error instanceof TwinActionError) return { error: error.message };
  throw error;
}

export const startSyncTool = defineTool({
  name: "start_sync",
  title: "Re-sync my wallet",
  description:
    "Starts a sync: new on-chain history from Tatum, priced and classified, then profile, insights, milestones and " +
    "trade memories written to Walrus. Runs in the background (about a minute); poll get_sync_status. Safe to repeat.",
  access: "twin:sync",
  bucket: "sync",
  input: z.object({}),
  output: z.object({ runId: z.string(), alreadyRunning: z.boolean() }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  run: async (_args, principal) => {
    const { address } = owner(principal);
    const { runId, alreadyRunning } = await startSyncRun(address);
    if (!alreadyRunning) after(() => runSync(runId, address));
    return {
      data: { runId, alreadyRunning },
      summary: alreadyRunning ? "A sync is already running. Poll get_sync_status." : "Sync started. Poll get_sync_status.",
    };
  },
});

export const setPublishedTool = defineTool({
  name: "set_published",
  title: "Publish or unpublish my twin",
  description:
    "Publishing puts the twin on the public leaderboard with a public page and chat that only see its profile, " +
    "insights, milestones and aggregate stats. Unpublishing removes all of that immediately. Confirm with the user first.",
  access: "twin:publish",
  input: z.object({ published: z.boolean() }),
  output: z.object({ published: z.boolean(), publicUrl: z.string().nullable() }),
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  run: async ({ published }, principal) => {
    const me = owner(principal);
    try {
      await setPublished({ address: me.address, demo: me.demo }, published);
    } catch (error: unknown) {
      return asUserError(error);
    }
    return {
      data: { published, publicUrl: published ? absoluteUrl(`/twin/${me.address}`) : null },
      summary: published ? "Your twin is public." : "Your twin is private again.",
    };
  },
});

export const followTwinTool = defineTool({
  name: "follow_twin",
  title: "Paper-copy a twin",
  description:
    `Starts a SIMULATED $1,000 paper portfolio that mirrors a published twin's future swaps (up to ${MAX_FOLLOWS} at once). ` +
    `Re-following restarts it. No real funds or trades. ${NOTICE}`,
  access: "copy:trade",
  bucket: "follow",
  input: z.object({ leader: addressInput }),
  output: z.object({ leader: z.string(), following: z.boolean(), startingUsd: z.number(), portfolioUrl: z.string() }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  run: async ({ leader: input }, principal) => {
    const me = owner(principal);
    const leader = parseSuiAddress(input);
    if (!leader) return { error: "That doesn't look like a Sui address." };
    try {
      await followLeader(me.address, leader);
    } catch (error: unknown) {
      return asUserError(error);
    }
    return {
      data: { leader, following: true, startingUsd: 1000, portfolioUrl: absoluteUrl("/portfolio") },
      summary: "Paper copy started with $1,000 of simulated money.",
    };
  },
});

export const unfollowTwinTool = defineTool({
  name: "unfollow_twin",
  title: "Stop paper-copying a twin",
  description: "Stops a simulated paper copy. Its history stays visible until you follow the twin again.",
  access: "copy:trade",
  bucket: "follow",
  input: z.object({ leader: addressInput }),
  output: z.object({ leader: z.string(), following: z.boolean() }),
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  run: async ({ leader: input }, principal) => {
    const me = owner(principal);
    const leader = parseSuiAddress(input);
    if (!leader) return { error: "That doesn't look like a Sui address." };
    await unfollowLeader(me.address, leader);
    return { data: { leader, following: false }, summary: "Stopped paper-copying." };
  },
});

export const pollPaperTradesTool = defineTool({
  name: "poll_paper_trades",
  title: "Check for new leader trades",
  description:
    "Pulls new swaps from every followed leader through Tatum and mirrors them into the simulated portfolios. " +
    "Then call get_paper_portfolio.",
  access: "copy:trade",
  bucket: "poll",
  input: z.object({}),
  output: z.object({
    follows: z.number(),
    newTrades: z.number(),
    filled: z.number(),
    skipped: z.number(),
    pausedLeaders: z.number(),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  run: async (_args, principal) => {
    const summary = await pollFollows(owner(principal).address);
    return {
      data: { ...summary },
      summary: `${summary.newTrades} new leader trades: ${summary.filled} copied, ${summary.skipped} skipped.`,
    };
  },
});

export const ACTION_TOOLS = [startSyncTool, setPublishedTool, followTwinTool, unfollowTwinTool, pollPaperTradesTool];
