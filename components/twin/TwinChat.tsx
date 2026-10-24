"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { type FormEvent, useMemo, useState } from "react";

interface TwinChatProps {
  api: string;
  /** Who is speaking with the twin, for labels and copy. */
  audience: "owner" | "public";
  suggestions: string[];
  twinName: string;
}

export function TwinChat({ api, audience, suggestions, twinName }: TwinChatProps) {
  const transport = useMemo(() => new DefaultChatTransport({ api }), [api]);
  const { messages, sendMessage, status, error } = useChat({ transport });
  const [input, setInput] = useState("");
  const isBusy = status === "submitted" || status === "streaming";

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    void sendMessage({ text: trimmed });
    setInput("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(input);
  }

  return (
    <section aria-label={`Chat with ${twinName}`} className="flex min-h-[32rem] flex-col border-2 border-ink bg-paper shadow-[6px_6px_0_var(--ink)]">
      <header className="flex items-center justify-between border-b-2 border-ink px-4 py-3">
        <p className="font-display text-lg font-bold">{twinName}</p>
        <p className="font-mono text-[0.7rem] uppercase tracking-widest text-ink-soft">
          {audience === "owner" ? "Private · remembers what you tell it" : "Public · profile & insights only"}
        </p>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5" aria-live="polite">
        {messages.length === 0 && (
          <div>
            <p className="text-ink-soft">
              {audience === "owner"
                ? "Ask me anything about how you trade. I remember your on-chain history, and what you tell me."
                : "Ask how this wallet trades. I only share its public profile, insights and milestones."}
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => send(suggestion)}
                    className="rounded-sm border border-ink px-3 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-ink hover:text-paper"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {messages.map((message) => (
          <article key={message.id} className={message.role === "user" ? "pl-8" : "pr-8"}>
            <p className={`font-mono text-[0.65rem] uppercase tracking-widest ${message.role === "user" ? "text-ink-soft" : "text-signal"}`}>
              {message.role === "user" ? (audience === "owner" ? "You" : "Visitor") : "Twin"}
            </p>
            <div className={`mt-1 whitespace-pre-wrap leading-relaxed ${message.role === "user" ? "text-ink-soft" : "text-lg"}`}>
              {message.parts.map((part, index) => (part.type === "text" ? <span key={index}>{part.text}</span> : null))}
            </div>
          </article>
        ))}
        {status === "submitted" && <p className="font-mono text-xs text-ink-soft">Twin is remembering…</p>}
        {error && (
          <p role="alert" className="text-sm text-loss">
            {error.message || "Something went wrong. Please try again."}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t-2 border-ink p-3">
        <label htmlFor="twin-chat-input" className="sr-only">
          Message your twin
        </label>
        <input
          id="twin-chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          maxLength={2000}
          placeholder={audience === "owner" ? "Why did I sell…?" : "How does this wallet trade?"}
          className="min-w-0 flex-1 rounded-sm border border-rule bg-paper px-3 py-2 placeholder:text-ink-soft/70 focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="rounded-sm bg-signal px-4 py-2 font-mono text-xs uppercase tracking-widest text-signal-ink transition-opacity duration-150 disabled:opacity-50"
        >
          Ask
        </button>
      </form>
      <p className="border-t border-rule px-4 py-2 text-[0.7rem] text-ink-soft">
        Not financial advice. Answers come from on-chain data and memories, and can be wrong.
      </p>
    </section>
  );
}
