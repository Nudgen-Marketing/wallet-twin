import { convertToModelMessages, streamText } from "ai";
import type { NextRequest } from "next/server";
import { hasLanguageModel } from "@/lib/ai";
import { parseSuiAddress } from "@/lib/auth/message";
import { clientIp, fail, isSameOrigin, readJson } from "@/lib/http/api";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { parseChatRequest } from "@/lib/twin/chat-request";
import { buildTwinChat } from "@/lib/twin/chat";
import { isPublished } from "@/lib/twin/publish";

export const maxDuration = 60;

// Visitors don't need to sign in, so limit per IP to keep LLM spend bounded.
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

/** Public chat with a published twin: profile, insight and milestone memories only, nothing saved. */
export async function POST(request: NextRequest, context: RouteContext<"/api/twin/[address]/chat">) {
  if (!isSameOrigin(request)) return fail("Cross-site request blocked", 403);
  if (!limiter.take(clientIp(request))) return fail("Too many questions. Try again in a minute.", 429);
  if (!hasLanguageModel()) return fail("Chat isn't configured on this server.", 503);

  const address = parseSuiAddress((await context.params).address);
  if (!address || !(await isPublished(address))) return fail("This twin isn't public.", 404);

  const parsed = await parseChatRequest(await readJson(request));
  if ("error" in parsed) return fail(parsed.error, 400);

  const chat = await buildTwinChat({ address, audience: "public", userText: parsed.userText });
  const result = streamText({
    model: chat.model,
    system: chat.system,
    messages: await convertToModelMessages(parsed.messages),
  });
  return result.toUIMessageStreamResponse({
    onError: (error: unknown) => {
      console.error("[public-chat] stream failed", error instanceof Error ? error.message : error);
      return "This twin lost its train of thought. Please try again.";
    },
  });
}
