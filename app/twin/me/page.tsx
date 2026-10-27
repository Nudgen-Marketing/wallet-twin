import { formatAddress } from "@mysten/sui/utils";
import Link from "next/link";
import { Suspense } from "react";
import { MemoryBadge } from "@/components/sync/MemoryBadge";
import { StatsPanel } from "@/components/twin/StatsPanel";
import { PublishToggle } from "@/components/twin/PublishToggle";
import { TwinChat } from "@/components/twin/TwinChat";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { memoryBackendName } from "@/lib/memory";
import { loadTwinSnapshot } from "@/lib/twin/data";
import { isPublished } from "@/lib/twin/publish";

const SUGGESTIONS = [
  "What's my worst habit?",
  "Why do I keep losing on my favorite token?",
  "When am I at my best?",
  "Describe my trading style in one sentence.",
];

export default function MyTwinPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
      <p className="kicker">My twin</p>
      <Suspense fallback={<p className="mt-6 text-ink-soft">Waking your twin…</p>}>
        <MyTwin />
      </Suspense>
    </main>
  );
}

async function MyTwin() {
  const session = await getSession();
  if (!session) {
    return (
      <>
        <h1 className="mt-3 fringe font-display text-5xl font-bold uppercase tracking-tight">Your twin is waiting</h1>
        <p className="mt-6 text-lg text-ink-soft">Connect your wallet and sign in (top right) to meet it.</p>
      </>
    );
  }

  const [snapshot, state, published] = await Promise.all([
    loadTwinSnapshot(session.address),
    db.syncState.findUnique({ where: { address: session.address } }),
    isPublished(session.address),
  ]);

  if (!state) {
    return (
      <>
        <h1 className="mt-3 fringe font-display text-5xl font-bold uppercase tracking-tight">No twin yet</h1>
        <p className="mt-6 text-lg text-ink-soft">
          Your twin is built from your history.{" "}
          <Link href="/sync" className="link-volt">
            Sync your wallet
          </Link>{" "}
          first. It takes about a minute.
        </p>
      </>
    );
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="fringe font-display text-5xl font-bold uppercase tracking-tight sm:text-6xl">
          Twin of <span className="block font-mono text-3xl font-medium normal-case text-signal sm:inline sm:text-4xl">{formatAddress(session.address)}</span>
        </h1>
        <div className="flex items-center gap-3">
          <MemoryBadge backend={memoryBackendName()} />
          <Link href="/sync" className="btn btn-ghost btn-sm">
            Re-sync
          </Link>
        </div>
      </div>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-10 lg:sticky lg:top-8 lg:self-start">
          <StatsPanel stats={snapshot.stats} historyFromMs={state.historyFromMs?.getTime() ?? null} />
          <PublishToggle address={session.address} initialPublished={published} isDemo={session.demo} />
        </div>
        <div>
          {session.demo && (
            <p className="mb-4 border-l-2 border-signal bg-signal/5 py-2 pl-4 pr-3 text-sm text-ink-soft">
              Demo mode: you&apos;re exploring a seeded mainnet wallet. Chat works, but nothing you say is remembered,
              because this demo is shared with every visitor.
            </p>
          )}
          <TwinChat api="/api/chat" audience="owner" suggestions={SUGGESTIONS} twinName="Your twin" />
        </div>
      </div>
    </>
  );
}
