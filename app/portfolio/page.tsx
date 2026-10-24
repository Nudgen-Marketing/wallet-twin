import { formatAddress } from "@mysten/sui/utils";
import Link from "next/link";
import { Suspense } from "react";
import { PortfolioPoller } from "@/components/copy/PortfolioPoller";
import { getSession } from "@/lib/auth/session";
import { FEE_RATE, LEADER_FEE_SHARE } from "@/lib/copy/engine";
import { type FollowView, loadPortfolio } from "@/lib/copy/portfolio";
import { formatDate, formatDateTime, formatUsd } from "@/lib/twin/format";

export default function PortfolioPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-signal">Paper portfolio</p>
        <span className="rounded-sm bg-ink px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-widest text-paper">
          Simulated · no real funds
        </span>
      </div>
      <h1 className="mt-3 font-display text-5xl font-black tracking-tight sm:text-6xl">Copy-trading, on paper</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-soft">
        Each twin you follow gets $1,000 of simulated money. When the leader swaps on Sui, we mirror the same share of
        their position at that moment&apos;s price. No transaction is ever sent. A {FEE_RATE * 100}% paper fee on copied
        volume shows what this model would pay: {LEADER_FEE_SHARE * 100}% to the leader, the rest to the platform.
      </p>
      <Suspense fallback={<p className="mt-8 text-ink-soft">Loading your paper portfolio…</p>}>
        <Portfolio />
      </Suspense>
    </main>
  );
}

async function Portfolio() {
  const session = await getSession();
  if (!session) return <p className="mt-8 text-lg text-ink-soft">Sign in (top right) to see your paper portfolio.</p>;

  const follows = await loadPortfolio(session.address);
  if (follows.length === 0) {
    return (
      <p className="mt-8 text-lg text-ink-soft">
        You aren&apos;t paper-copying anyone yet. Pick a twin on the{" "}
        <Link href="/leaderboard" className="text-ink underline decoration-signal decoration-2 underline-offset-4">
          leaderboard
        </Link>
        .
      </p>
    );
  }

  const totals = follows.reduce(
    (sum, follow) => ({
      value: sum.value + follow.valueUsd,
      start: sum.start + follow.startingUsd,
      volume: sum.volume + follow.copiedVolumeUsd,
      leader: sum.leader + follow.leaderEarnedUsd,
      platform: sum.platform + follow.platformEarnedUsd,
    }),
    { value: 0, start: 0, volume: 0, leader: 0, platform: 0 },
  );

  return (
    <>
      <div className="mt-10 grid gap-6 border-y-2 border-ink py-6 sm:grid-cols-4">
        <Total label="Paper value" value={formatUsd(totals.value)} />
        <Total
          label="Paper PnL"
          value={formatUsd(totals.value - totals.start, { signed: true })}
          tone={totals.value - totals.start}
        />
        <Total label="Copied volume" value={formatUsd(totals.volume)} />
        <Total label="Leaders would have earned" value={formatUsd(totals.leader)} note={`platform ${formatUsd(totals.platform)}`} />
      </div>
      <div className="mt-6">
        <PortfolioPoller />
      </div>
      <div className="mt-10 space-y-10">
        {follows.map((follow) => (
          <FollowCard key={follow.leader} follow={follow} />
        ))}
      </div>
    </>
  );
}

function Total({ label, value, tone = 0, note }: { label: string; value: string; tone?: number; note?: string }) {
  return (
    <div>
      <p className="font-mono text-[0.7rem] uppercase tracking-widest text-ink-soft">{label}</p>
      <p className={`mt-1 font-display text-3xl font-black tabular-nums ${tone > 0 ? "text-gain" : tone < 0 ? "text-loss" : ""}`}>
        {value}
      </p>
      {note && <p className="font-mono text-xs text-ink-soft">{note}</p>}
    </div>
  );
}

function FollowCard({ follow }: { follow: FollowView }) {
  const tone = follow.pnlUsd > 0 ? "text-gain" : follow.pnlUsd < 0 ? "text-loss" : "";
  return (
    <article className="border-2 border-ink bg-paper p-5 shadow-[6px_6px_0_var(--ink)]">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">
          Copying{" "}
          <Link href={`/twin/${follow.leader}`} className="font-mono text-xl underline decoration-signal decoration-2 underline-offset-4">
            {formatAddress(follow.leader)}
          </Link>
        </h2>
        <p className="font-mono text-xs text-ink-soft">
          since {formatDate(follow.startedAt.getTime())}
          {follow.lastPolledAt ? ` · checked ${formatDateTime(follow.lastPolledAt.getTime())}` : ""}
          {!follow.leaderIsPublic && <span className="ml-2 text-loss">· leader went private, copying paused</span>}
        </p>
      </header>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Fact label="Value" value={formatUsd(follow.valueUsd)} />
        <Fact label="PnL" value={`${formatUsd(follow.pnlUsd, { signed: true })} (${follow.pnlPct.toFixed(1)}%)`} className={tone} />
        <Fact label="Trades" value={`${follow.filled} copied · ${follow.skipped} skipped`} />
        <Fact label="Fees paid" value={formatUsd(follow.feesUsd)} />
        <Fact label="Leader earned" value={formatUsd(follow.leaderEarnedUsd)} className="text-signal" />
      </dl>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <section>
          <h3 className="font-mono text-[0.7rem] uppercase tracking-widest text-ink-soft">Holdings</h3>
          <ul className="mt-2 space-y-1 font-mono text-sm">
            <li className="flex justify-between">
              <span>Paper cash</span>
              <span className="tabular-nums">{formatUsd(follow.cashUsd)}</span>
            </li>
            {follow.holdings.slice(0, 5).map((holding) => (
              <li key={holding.symbol} className="flex justify-between">
                <span>{holding.symbol}</span>
                <span className="tabular-nums">{formatUsd(holding.valueUsd)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">Positions marked at the leader&apos;s last traded price.</p>
        </section>
        <section>
          <h3 className="font-mono text-[0.7rem] uppercase tracking-widest text-ink-soft">Recent paper trades</h3>
          {follow.recentTrades.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Waiting for the leader&apos;s next swap.</p>
          ) : (
            <ul className="mt-2 divide-y divide-rule text-sm">
              {follow.recentTrades.map((trade) => (
                <li key={trade.digest} className="grid grid-cols-[8.5rem_1fr_auto] gap-3 py-1.5">
                  <span className="font-mono text-xs text-ink-soft">{formatDateTime(trade.timestampMs)}</span>
                  <span className={trade.status === "skipped" ? "text-ink-soft" : ""}>{trade.summary}</span>
                  <span className="font-mono text-xs tabular-nums text-ink-soft">
                    {trade.volumeUsd !== null ? `${formatUsd(trade.volumeUsd)} · fee ${formatUsd(trade.feeUsd)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}

function Fact({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <dt className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">{label}</dt>
      <dd className={`mt-0.5 font-display text-lg font-bold tabular-nums ${className}`}>{value}</dd>
    </div>
  );
}
