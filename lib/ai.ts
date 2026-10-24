import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import { env, requireSecret } from "@/lib/env";

/** The single place the app picks its LLM (Anthropic Claude via the Vercel AI SDK). */

let provider: ReturnType<typeof createAnthropic> | undefined;

export function hasLanguageModel(): boolean {
  return Boolean(env().ANTHROPIC_API_KEY);
}

export function languageModel(): LanguageModel {
  const workspaceId = env().ANTHROPIC_WORKSPACE_ID;
  provider ??= createAnthropic({
    apiKey: requireSecret("ANTHROPIC_API_KEY"),
    ...(workspaceId ? { headers: { "anthropic-workspace-id": workspaceId } } : {}),
  });
  return provider(env().ANTHROPIC_MODEL);
}
