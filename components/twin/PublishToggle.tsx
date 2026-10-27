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
    <section aria-labelledby="publish-heading" className={`panel p-6 ${published ? "panel-hot" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="publish-heading" className="font-display text-2xl font-semibold uppercase tracking-wide">
          {published ? "Your twin is public" : "Your twin is private"}
        </h2>
        <span
          className={`flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.18em] ${published ? "text-gain" : "text-ink-soft"}`}
        >
          {published && <span className="status-dot" aria-hidden />}
          {published ? "On the leaderboard" : "○ Only you can see it"}
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
          className={`btn btn-sm ${published ? "btn-ghost" : "btn-volt"}`}
        >
          {isSaving ? "Saving…" : published ? "Unpublish" : "Publish my twin"}
        </button>
        {published && (
          <Link href={`/twin/${address}`} className="link-volt text-sm">
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
