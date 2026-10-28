"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { SyncStatus } from "@/lib/sync/status";
import { apiCall } from "@/lib/http/client";
import { MemoryBadge } from "@/components/sync/MemoryBadge";

const RUN_POLL_MS = 1500;
const MEMORY_POLL_MS = 5000;
const MEMORY_POLL_LIMIT = 36; // ~3 minutes of waiting on Walrus confirmations

type StageKey = "history" | "analyze" | "twin" | "memory";
const STAGES: { key: StageKey; title: string }[] = [
  { key: "history", title: "Reading your chain through Tatum" },
  { key: "analyze", title: "Classifying & pricing every trade" },
  { key: "twin", title: "Writing your twin's profile & insights" },
  { key: "memory", title: "Committing memories to Walrus" },
];
const ORDER: Record<string, number> = { history: 0, analyze: 1, twin: 2, memory: 3, done: 4 };

function stageState(status: SyncStatus, key: StageKey): "done" | "active" | "waiting" {
  const run = status.run;
  if (!run) return "waiting";
  const current = ORDER[run.stage];
  if (current > ORDER[key]) return key === "memory" && status.memory.pending > 0 ? "active" : "done";
  if (current === ORDER[key]) return run.status === "running" ? "active" : "done";
  return "waiting";
}

function detail(status: SyncStatus, key: StageKey): string | null {
  const progress = status.run?.progress ?? {};
  switch (key) {
    case "history": {
      if (progress.transactions === undefined) return null;
      const since = status.historyFrom ?? (progress.historyFromMs ? new Date(progress.historyFromMs).toISOString() : null);
      const window = since ? ` · indexed since ${since.slice(0, 10)}` : "";
      return `${progress.transactions.toLocaleString()} transactions${progress.hitCap ? " (demo cap reached)" : ""}${window}`;
    }
    case "analyze":
      return progress.newActivities === undefined
        ? null
        : `${progress.newActivities.toLocaleString()} new activities · ${progress.pricesFetched ?? 0} historical prices fetched`;
    case "twin":
      return ORDER[status.run?.stage ?? "history"] > ORDER.twin ? "Profile, insights and milestones drafted" : null;
    case "memory": {
      const { done, pending, failed } = status.memory;
      if (done + pending + failed === 0) return null;
      return `${done} stored · ${pending} confirming on Walrus${failed ? ` · ${failed} failed` : ""}`;
    }
  }
}

export function SyncPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [memoryPolls, setMemoryPolls] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const next = await apiCall<SyncStatus>("/api/sync/status", { cache: "no-store" });
      setStatus(next);
      return next;
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Couldn't load sync status.");
      return null;
    }
  }, []);

  const start = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    setMemoryPolls(0);
    try {
      await apiCall("/api/sync", { method: "POST" });
      await refresh();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Couldn't start the sync.");
    } finally {
      setIsStarting(false);
    }
  }, [refresh]);

  // First visit: kick off a sync automatically; later visits just show the last one.
  useEffect(() => {
    let cancelled = false;
    apiCall<SyncStatus>("/api/sync/status", { cache: "no-store" })
      .then((initial) => {
        if (cancelled) return;
        setStatus(initial);
        if (!initial.run) void start();
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Couldn't load sync status.");
      });
    return () => {
      cancelled = true;
    };
  }, [start]);

  const isRunning = status?.run?.status === "running";
  const isConfirming = !isRunning && (status?.memory.pending ?? 0) > 0 && memoryPolls < MEMORY_POLL_LIMIT;

  useEffect(() => {
    if (!isRunning && !isConfirming) return;
    const timer = setTimeout(() => {
      if (!isRunning) setMemoryPolls((count) => count + 1);
      void refresh();
    }, isRunning ? RUN_POLL_MS : MEMORY_POLL_MS);
    return () => clearTimeout(timer);
  }, [status, isRunning, isConfirming, refresh]);

  const isDone = status?.run?.status === "done";

  return (
    <section aria-labelledby="sync-heading" className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
        <h2 id="sync-heading" className="hud-label">
          {isRunning ? "Sync in progress" : isDone ? "Last sync complete" : status?.run?.status === "failed" ? "Sync failed" : "Ready"}
        </h2>
        {status && <MemoryBadge backend={status.memory.backend} />}
      </div>

      <ol className="relative mt-6 space-y-0">
        {STAGES.map((stage, index) => {
          const state = status ? stageState(status, stage.key) : "waiting";
          const info = status ? detail(status, stage.key) : null;
          return (
            <li
              key={stage.key}
              className={`relative grid grid-cols-[3.5rem_1fr] gap-4 border-b border-rule/60 py-5 pl-3 transition-colors duration-300 last:border-b-0 ${
                state === "active" ? "bg-signal/5" : ""
              }`}
            >
              <span
                aria-hidden
                className={`absolute inset-y-0 left-0 w-0.5 transition-colors duration-300 ${
                  state === "done" ? "bg-gain" : state === "active" ? "bg-signal" : "bg-transparent"
                }`}
              />
              <span
                aria-hidden
                className={`font-display text-4xl font-bold leading-none tabular-nums transition-colors duration-300 ${
                  state === "done" ? "text-ink" : state === "active" ? "text-signal" : "numeral-outline"
                }`}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className={`text-xl font-semibold uppercase tracking-wide ${state === "waiting" ? "text-ink-soft" : ""}`}>
                  {stage.title}
                  <span className="sr-only">: {state}</span>
                  {state === "active" && (
                    <span className="status-dot ml-3 align-middle text-signal" aria-hidden />
                  )}
                  {state === "done" && <span className="ml-3 font-mono text-sm text-gain" aria-hidden>✓</span>}
                </p>
                {info && <p className="mt-1 font-mono text-sm text-ink-soft">{info}</p>}
                {state === "active" && <span aria-hidden className="scan-bar mt-3 block h-0.5 w-full max-w-sm bg-rule" />}
              </div>
            </li>
          );
        })}
      </ol>

      {(error || status?.run?.error) && (
        <p role="alert" className="mt-4 text-loss">
          {error ?? status?.run?.error}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {isDone && (
          <>
            <Link
              href="/twin/me"
              className="btn btn-volt"
            >
              Talk to your twin →
            </Link>
            <Link
              href="/wrapped"
              className="btn btn-ghost"
            >
              Your Wallet Wrapped
            </Link>
          </>
        )}
        <button
          type="button"
          onClick={start}
          disabled={isRunning || isStarting}
          className="px-2 py-3 font-mono text-xs uppercase tracking-[0.18em] text-ink-soft underline decoration-rule underline-offset-4 transition-colors hover:text-signal hover:decoration-signal disabled:opacity-50"
        >
          {isStarting ? "Starting…" : "Sync new activity"}
        </button>
      </div>
    </section>
  );
}
