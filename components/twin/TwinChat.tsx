"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

/** Distance from the bottom, in px, within which the log keeps following new text. */
const FOLLOW_THRESHOLD_PX = 120;

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
  const logRef = useRef<HTMLDivElement>(null);
  const isFollowingRef = useRef(true);

  // Keep the newest reply in view while it streams, unless the reader scrolled up to reread.
  useEffect(() => {
    const log = logRef.current;
    if (log && isFollowingRef.current) log.scrollTop = log.scrollHeight;
  }, [messages, status]);

  function handleScroll() {
    const log = logRef.current;
    if (!log) return;
    isFollowingRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < FOLLOW_THRESHOLD_PX;
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    isFollowingRef.current = true;
    void sendMessage({ text: trimmed });
    setInput("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(input);
  }

  return (
    <section aria-label={`Chat with ${twinName}`} className="panel panel-hot flex h-[min(46rem,calc(100dvh-6rem))] min-h-[26rem] flex-col lg:h-[min(48rem,calc(100dvh-14rem))]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-paper-raised/60 px-5 py-3">
        <p className="flex items-center gap-2.5 font-display text-lg font-semibold uppercase tracking-wide">
          <span className={`status-dot ${isBusy ? "text-signal" : "text-gain"}`} aria-hidden />
          {twinName}
        </p>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-soft">
          {audience === "owner" ? "Private · remembers what you tell it" : "Public · profile & insights only"}
        </p>
      </header>

      <div
        ref={logRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5"
        aria-live="polite"
      >
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
                    className="border border-rule bg-paper/60 px-3 py-1.5 text-left text-sm transition-colors duration-150 hover:border-signal hover:text-signal"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {messages.map((message) => (
          <article
            key={message.id}
            className={`rise ${message.role === "user" ? "ml-8 border-r-2 border-rule pr-3 text-right" : "mr-8 border-l-2 border-cyan pl-3"}`}
          >
            <p className={`font-mono text-[0.62rem] uppercase tracking-[0.2em] ${message.role === "user" ? "text-ink-soft" : "text-cyan"}`}>
              {message.role === "user" ? (audience === "owner" ? "You" : "Visitor") : "Twin"}
            </p>
            <div className={`mt-1 whitespace-pre-wrap leading-relaxed ${message.role === "user" ? "text-ink-soft" : "text-lg"}`}>
              {message.parts.map((part, index) => (part.type === "text" ? <span key={index}>{part.text}</span> : null))}
            </div>
          </article>
        ))}
        {status === "submitted" && (
          <p className="cursor-blink font-mono text-xs uppercase tracking-[0.18em] text-cyan">Twin is remembering…</p>
        )}
        {error && (
          <p role="alert" className="text-sm text-loss">
            {error.message || "Something went wrong. Please try again."}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex shrink-0 gap-2 border-t border-rule p-3">
        <label htmlFor="twin-chat-input" className="sr-only">
          Message your twin
        </label>
        <input
          id="twin-chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          maxLength={2000}
          placeholder={audience === "owner" ? "Why did I sell…?" : "How does this wallet trade?"}
          className="min-w-0 flex-1 border border-rule bg-paper px-3 py-2 font-mono text-sm placeholder:text-ink-soft/60 focus:border-signal focus:shadow-[0_0_0_1px_var(--signal),0_0_18px_-4px_var(--signal)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="btn btn-volt btn-sm"
        >
          Ask
        </button>
      </form>
      <p className="shrink-0 border-t border-rule px-5 py-2 text-[0.7rem] text-ink-soft">
        Not financial advice. Answers come from on-chain data and memories, and can be wrong.
      </p>
    </section>
  );
}
