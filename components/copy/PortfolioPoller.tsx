"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiCall } from "@/lib/http/client";

interface PollSummary {
  follows: number;
  newTrades: number;
  filled: number;
  skipped: number;
  pausedLeaders: number;
}

/** Pulls new leader trades through Tatum on load and on demand (Sui has no Tatum webhooks). */
export function PortfolioPoller() {
  const router = useRouter();
  const [isPolling, setIsPolling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const poll = useCallback(async () => {
    setIsPolling(true);
    try {
      const summary = await apiCall<PollSummary>("/api/copy/poll", { method: "POST" });
      setMessage(
        summary.newTrades === 0
          ? "No new leader trades since the last check."
          : `${summary.newTrades} new leader trades: ${summary.filled} copied, ${summary.skipped} skipped.`,
      );
      router.refresh();
    } catch (caught: unknown) {
      setMessage(caught instanceof Error ? caught.message : "Couldn't check for new trades.");
    } finally {
      setIsPolling(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => void poll(), 0);
    return () => clearTimeout(timer);
  }, [poll]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={poll}
        disabled={isPolling}
        className="rounded-sm border border-ink px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors duration-150 hover:bg-ink hover:text-paper disabled:opacity-50"
      >
        {isPolling ? "Checking Tatum…" : "Check for new trades"}
      </button>
      {message && (
        <p className="font-mono text-xs text-ink-soft" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
