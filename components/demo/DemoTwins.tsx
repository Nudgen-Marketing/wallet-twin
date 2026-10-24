import { formatAddress } from "@mysten/sui/utils";
import Link from "next/link";
import { connection } from "next/server";
import { DemoLoginButton } from "@/components/demo/DemoLoginButton";
import { db } from "@/lib/db";
import { demoWallets } from "@/lib/demo";

/** Seeded mainnet twins judges can explore without a wallet. */
export async function DemoTwins() {
  await connection();
  const wallets = demoWallets();
  const entries = await db.leaderboardEntry.findMany({ where: { address: { in: wallets.map((w) => w.address) } } });
  const seeded = wallets.filter((wallet) => entries.some((entry) => entry.address === wallet.address));
  if (seeded.length === 0) return null;

  return (
    <section aria-labelledby="demo-heading" className="mx-auto max-w-6xl px-4 pb-[var(--space-section)] sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink pb-2">
        <h2 id="demo-heading" className="font-display text-3xl font-bold">
          No wallet handy? Try a demo twin
        </h2>
        <span className="font-mono text-xs uppercase tracking-widest text-ink-soft">Real Sui mainnet wallets</span>
      </div>
      <ul className="mt-6 grid gap-6 md:grid-cols-2">
        {seeded.map((wallet) => {
          const entry = entries.find((row) => row.address === wallet.address);
          return (
            <li key={wallet.address} className="border-2 border-ink bg-paper p-5 shadow-[5px_5px_0_var(--ink)]">
              <p className="font-mono text-xs uppercase tracking-widest text-signal">{wallet.label}</p>
              <p className="mt-1 font-mono text-sm">{formatAddress(wallet.address)}</p>
              {entry?.headline && <p className="mt-3 leading-relaxed text-ink-soft">{entry.headline}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <DemoLoginButton address={wallet.address} />
                <Link
                  href={`/twin/${wallet.address}`}
                  className="text-sm underline decoration-signal decoration-2 underline-offset-4"
                >
                  Public page
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
