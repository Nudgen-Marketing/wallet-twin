"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiCall } from "@/lib/http/client";

interface PublishToggleProps {
  address: string;
  initialPublished: boolean;
  isDemo?: boolean;
}

export function PublishToggle({ address, initialPublished, isDemo = false }: PublishToggleProps) {
  const router = useRouter();
  const [published, setPublished] = useState(initialPublished);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setIsSaving(true);
    setError(null);
    try {
      const result = await apiCall<{ published: boolean }>("/api/publish", {
        method: "POST",
        body: JSON.stringify({ publish: !published }),
      });
      setPublished(result.published);
      router.refresh();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Couldn't update your twin.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section aria-labelledby="publish-heading" className="border-2 border-ink p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="publish-heading" className="font-display text-2xl font-bold">
          {published ? "Your twin is public" : "Your twin is private"}
        </h2>
        <span
          className={`font-mono text-[0.7rem] uppercase tracking-widest ${published ? "text-gain" : "text-ink-soft"}`}
        >
          {published ? "● On the leaderboard" : "○ Only you can see it"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        Publishing shows your <strong className="text-ink">profile, insights, milestones and stats</strong> on the
        leaderboard and lets visitors chat with a public version of your twin, and paper-copy your trades.{" "}
        <strong className="text-ink">What you tell your twin in private and your individual trades are never shared.</strong>{" "}
        You can unpublish any time.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          disabled={isSaving || (isDemo && published)}
          title={isDemo && published ? "Demo twins stay public so everyone can try them." : undefined}
          className={`rounded-sm px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors duration-150 disabled:opacity-50 ${
            published ? "border border-ink hover:bg-ink hover:text-paper" : "bg-ink text-paper hover:bg-signal hover:text-signal-ink"
          }`}
        >
          {isSaving ? "Saving…" : published ? "Unpublish" : "Publish my twin"}
        </button>
        {published && (
          <Link href={`/twin/${address}`} className="text-sm underline decoration-signal decoration-2 underline-offset-4">
            View public page →
          </Link>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-loss">
          {error}
        </p>
      )}
    </section>
  );
}
