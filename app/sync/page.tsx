import { formatAddress } from "@mysten/sui/utils";
import { Suspense } from "react";
import { SyncPanel } from "@/components/sync/SyncPanel";
import { getSession } from "@/lib/auth/session";

export default function SyncPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <p className="font-mono text-xs uppercase tracking-widest text-signal">Sync</p>
      <h1 className="mt-3 font-display text-5xl font-black tracking-tight sm:text-6xl">Building your twin</h1>
      <Suspense fallback={<p className="mt-6 text-ink-soft">Checking your session…</p>}>
        <SessionGate />
      </Suspense>
    </main>
  );
}

async function SessionGate() {
  const session = await getSession();
  if (!session) {
    return (
      <p className="mt-6 text-lg text-ink-soft">
        Connect your wallet and sign in (top right) to start syncing your history.
      </p>
    );
  }
  return (
    <>
      <p className="mt-6 max-w-xl text-lg text-ink-soft">
        Signed in as{" "}
        <span className="font-mono text-base text-ink" title={session.address}>
          {formatAddress(session.address)}
        </span>
        . We read your history through Tatum, turn it into trades, and write what your twin learns to
        Walrus Memory. Re-syncing only adds what&apos;s new.
      </p>
      <SyncPanel />
    </>
  );
}
