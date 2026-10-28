import "server-only";
import type { CallToolResult, McpServer, ToolAnnotations } from "@modelcontextprotocol/server";
import type { z } from "zod";
import { type LimitBucket, takeCall } from "@/lib/mcp/limits";
import { hasScope, isSignedIn, type McpPrincipal } from "@/lib/mcp/principal";
import type { McpScope } from "@/lib/mcp/scopes";

/** Who may call a tool: anyone, any signed-in agent, or an agent holding one scope. */
export type ToolAccess = "public" | "signed_in" | McpScope;

/** A tool either returns data (plus a one-line summary for the model) or a user-facing error. */
export type ToolOutcome<T> = { data: T; summary: string } | { error: string };

interface ToolSpec<I extends z.ZodObject, O extends z.ZodObject> {
  name: string;
  title: string;
  description: string;
  access: ToolAccess;
  bucket?: LimitBucket;
  input: I;
  output: O;
  annotations: ToolAnnotations;
  run: (args: z.infer<I>, principal: McpPrincipal) => Promise<ToolOutcome<z.infer<O>>>;
}

export interface McpTool {
  name: string;
  access: ToolAccess;
  register: (server: McpServer, principal: McpPrincipal) => void;
}

export function canUse(access: ToolAccess, principal: McpPrincipal): boolean {
  if (access === "public") return true;
  if (access === "signed_in") return isSignedIn(principal);
  return hasScope(principal, access);
}

export function toolError(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

const SLOW_DOWN = "Too many calls. Wait a minute and try again.";
const UNEXPECTED = "WalletTwin hit an unexpected problem. Try again shortly.";

/**
 * Wraps a tool so every call is scope-checked, rate-limited and never leaks an internal error.
 * The text content repeats the JSON for clients that ignore structuredContent.
 */
export function defineTool<I extends z.ZodObject, O extends z.ZodObject>(spec: ToolSpec<I, O>): McpTool {
  const call = async (args: z.infer<I>, principal: McpPrincipal): Promise<CallToolResult> => {
    if (!canUse(spec.access, principal)) return toolError(`This needs the ${spec.access} permission. Reconnect WalletTwin and grant it.`);
    if (!takeCall(principal, spec.bucket)) return toolError(SLOW_DOWN);
    try {
      const outcome = await spec.run(args, principal);
      if ("error" in outcome) return toolError(outcome.error);
      return {
        content: [{ type: "text", text: `${outcome.summary}\n\n${JSON.stringify(outcome.data)}` }],
        structuredContent: outcome.data,
      };
    } catch (error: unknown) {
      console.error(`[mcp] ${spec.name} failed`, error instanceof Error ? error.message : error);
      return toolError(UNEXPECTED);
    }
  };

  return {
    name: spec.name,
    access: spec.access,
    register: (server, principal) => {
      // Widened to a concrete schema type so the SDK's conditional callback type resolves.
      const inputSchema: z.ZodObject = spec.input;
      const outputSchema: z.ZodObject = spec.output;
      server.registerTool(
        spec.name,
        {
          title: spec.title,
          description: spec.description,
          inputSchema,
          outputSchema,
          annotations: { title: spec.title, ...spec.annotations },
        },
        // The SDK has already validated args against spec.input.
        async (args) => call(args as z.infer<I>, principal),
      );
    },
  };
}

/** Registers only the tools this caller may use, so agents never see tools they can't call. */
export function registerTools(server: McpServer, principal: McpPrincipal, tools: readonly McpTool[]): void {
  for (const tool of tools) {
    if (canUse(tool.access, principal)) tool.register(server, principal);
  }
}
