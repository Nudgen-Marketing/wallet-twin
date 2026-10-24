"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiCall } from "@/lib/http/client";

interface FollowButtonProps {
  leader: string;
  initialFollowing: boolean;
  isSignedIn: boolean;
  isOwner: boolean;
}

export function FollowButton({ leader, initialFollowing, isSignedIn, isOwner }: FollowButtonProps) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isOwner) return null;

  async function toggle() {
    setIsSaving(true);
    setError(null);
    try {
      await apiCall("/api/follow", { method: "POST", body: JSON.stringify({ leader, follow: !following }) });
      setFollowing(!following);
      router.refresh();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Couldn't update the follow.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {isSignedIn ? (
        <button
          type="button"
          onClick={toggle}
          disabled={isSaving}
          className={`rounded-sm px-5 py-3 font-mono text-sm uppercase tracking-widest transition-transform duration-150 hover:-translate-y-0.5 disabled:opacity-50 ${
            following
              ? "border border-ink"
              : "bg-signal text-signal-ink shadow-[3px_3px_0_var(--ink)]"
          }`}
        >
          {isSaving ? "Saving…" : following ? "Stop paper-copying" : "Paper-copy this twin · $1,000 simulated"}
        </button>
      ) : (
        <p className="text-sm text-ink-soft">Sign in to paper-copy this twin with $1,000 of simulated funds.</p>
      )}
      {following && (
        <Link href="/portfolio" className="text-sm underline decoration-signal decoration-2 underline-offset-4">
          See your paper portfolio →
        </Link>
      )}
      <span className="font-mono text-[0.7rem] uppercase tracking-widest text-ink-soft">
        Simulated · no real trades · 0.5% paper fee
      </span>
      {error && (
        <p role="alert" className="w-full text-sm text-loss">
          {error}
        </p>
      )}
    </div>
  );
}
