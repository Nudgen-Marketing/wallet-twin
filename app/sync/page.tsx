import { formatAddress } from "@mysten/sui/utils";
import { Suspense } from "react";
import { getSession } from "@/lib/auth/session";

export default function SyncPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <p className="font-mono text-xs uppercase tracking-widest text-signal">Sync</p>
      <h1 className="mt-3 font-display text-5xl font-black tracking-tight">Building your twin</h1>
      <Suspense fallback={<p className="mt-6 text-ink-soft">Checking your session…</p>}>
        <SessionStatus />
      </Suspense>
    </main>
  );
}

async function SessionStatus() {
  const session = await getSession();
  if (!session) {
    return (
      <p className="mt-6 text-lg text-ink-soft">
        Connect your wallet and sign in (top right) to start syncing your history.
      </p>
    );
  }
  return (
    <div className="mt-6 space-y-3 text-lg">
      <p>
        Signed in as{" "}
        <span className="font-mono text-base" title={session.address}>
          {formatAddress(session.address)}
        </span>
        . Ownership verified by your wallet signature.
      </p>
      <p className="text-ink-soft">
        Next up: pulling your transaction history from Tatum and writing your twin to Walrus Memory.
      </p>
    </div>
  );
}
