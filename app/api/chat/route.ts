import { convertToModelMessages, streamText } from "ai";
import { after, type NextRequest } from "next/server";
import { hasLanguageModel } from "@/lib/ai";
import { getSession } from "@/lib/auth/session";
import { fail, isSameOrigin, readJson } from "@/lib/http/api";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { parseChatRequest } from "@/lib/twin/chat-request";
import { buildTwinChat } from "@/lib/twin/chat";

export const maxDuration = 60;

const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

/** Private chat between a signed-in owner and their own twin. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return fail("Cross-site request blocked", 403);
  const session = await getSession();
  if (!session) return fail("Sign in to talk to your twin.", 401);
  if (!limiter.take(session.address)) return fail("Your twin needs a breather. Try again in a minute.", 429);
  if (!hasLanguageModel()) return fail("Chat isn't configured on this server (missing ANTHROPIC_API_KEY).", 503);

  const parsed = await parseChatRequest(await readJson(request));
  if ("error" in parsed) return fail(parsed.error, 400);

  const chat = await buildTwinChat({
    address: session.address,
    audience: "owner",
    userText: parsed.userText,
    saveFacts: !session.demo,
  });
  const result = streamText({
    model: chat.model,
    system: chat.system,
    messages: await convertToModelMessages(parsed.messages),
  });
  // Once the reply has fully streamed, save what the owner told the twin.
  after(async () => {
    try {
      await result.text;
      await chat.afterResponse();
    } catch (error: unknown) {
      console.error("[chat] post-response memory step failed", error instanceof Error ? error.message : error);
    }
  });

  return result.toUIMessageStreamResponse({
    onError: (error: unknown) => {
      console.error("[chat] stream failed", error instanceof Error ? error.message : error);
      return "Your twin lost its train of thought. Please try again.";
    },
  });
}
