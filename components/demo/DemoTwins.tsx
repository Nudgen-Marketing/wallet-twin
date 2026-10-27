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
      <p className="kicker">Real Sui mainnet wallets</p>
      <h2 id="demo-heading" className="fringe mt-4 font-display text-4xl font-bold uppercase tracking-tight sm:text-5xl">
        No wallet handy? Try a demo twin
      </h2>
      <ul className="mt-8 grid gap-5 md:grid-cols-2">
        {seeded.map((wallet) => {
          const entry = entries.find((row) => row.address === wallet.address);
          return (
            <li key={wallet.address} className="reveal panel panel-interactive group p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="sandy-group font-mono text-xs uppercase tracking-[0.2em] text-signal">{wallet.label}</p>
                <span className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gain">
                  <span className="status-dot" aria-hidden />
                  Live
                </span>
              </div>
              <p className="mt-2 font-mono text-sm text-ink-soft">{formatAddress(wallet.address)}</p>
              {entry?.headline && <p className="mt-3 leading-relaxed text-ink-soft">{entry.headline}</p>}
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <DemoLoginButton address={wallet.address} />
                <Link
                  href={`/twin/${wallet.address}`}
                  className="link-volt text-sm"
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
