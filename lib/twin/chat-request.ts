import "server-only";
import { type UIMessage, validateUIMessages } from "ai";
import { z } from "zod";

export const MAX_USER_MESSAGE_CHARS = 2_000;
/** Only the recent turns go to the model; memory covers the long tail. */
export const MAX_HISTORY_MESSAGES = 12;

const bodySchema = z.object({ messages: z.array(z.unknown()).min(1).max(60) });

export type ChatRequest = { messages: UIMessage[]; userText: string } | { error: string };

function textOf(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim();
}

/** Validates a useChat request body and pulls out the latest user message. */
export async function parseChatRequest(body: unknown): Promise<ChatRequest> {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return { error: "Malformed chat request." };
  let messages: UIMessage[];
  try {
    messages = await validateUIMessages({ messages: parsed.data.messages });
  } catch {
    return { error: "Malformed chat messages." };
  }
  const last = messages.at(-1);
  if (!last || last.role !== "user") return { error: "The last message must come from you." };
  const userText = textOf(last);
  if (!userText) return { error: "Say something to your twin first." };
  if (userText.length > MAX_USER_MESSAGE_CHARS) return { error: "That message is too long." };
  // Clients can't smuggle in system/assistant instructions beyond normal turns.
  const turns = messages.filter((message) => message.role === "user" || message.role === "assistant");
  return { messages: turns.slice(-MAX_HISTORY_MESSAGES), userText };
}
