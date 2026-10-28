import "server-only";
import { generateText, type ModelMessage } from "ai";
import type { Audience } from "@/lib/memory";
import { MAX_HISTORY_MESSAGES, MAX_USER_MESSAGE_CHARS } from "@/lib/twin/chat-request";
import { buildTwinChat } from "@/lib/twin/chat";

export interface AskTurn {
  role: "user" | "assistant";
  text: string;
}

/**
 * One non-streaming question to a twin, for callers that aren't the browser chat (MCP tools).
 * Same prompt, memory scoping and fact capture as the streaming chat routes.
 */
export async function askTwin(input: {
  address: string;
  audience: Audience;
  question: string;
  history?: AskTurn[];
  saveFacts?: boolean;
}): Promise<string> {
  const question = input.question.trim().slice(0, MAX_USER_MESSAGE_CHARS);
  const chat = await buildTwinChat({
    address: input.address,
    audience: input.audience,
    userText: question,
    saveFacts: input.audience === "owner" && (input.saveFacts ?? false),
  });
  const history: ModelMessage[] = (input.history ?? [])
    .slice(-(MAX_HISTORY_MESSAGES - 1))
    .map((turn) => ({ role: turn.role, content: turn.text.slice(0, MAX_USER_MESSAGE_CHARS) }));
  const { text } = await generateText({
    model: chat.model,
    system: chat.system,
    messages: [...history, { role: "user", content: question }],
  });
  try {
    await chat.afterResponse();
  } catch (error: unknown) {
    console.error("[ask] post-response memory step failed", error instanceof Error ? error.message : error);
  }
  return text;
}
