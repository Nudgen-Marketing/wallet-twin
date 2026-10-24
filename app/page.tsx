import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { getLeaderboard } from "@/lib/twin/publish";

const STEPS = [
  {
    kicker: "01 · Read",
    title: "Your chain, pulled through Tatum",
    body: "We read your Sui transactions through Tatum's Sui gateway and turn raw balance changes into swaps, transfers, mints and stakes.",
  },
  {
    kicker: "02 · Remember",
    title: "A twin that lives in Walrus Memory",
    body: "Your trading style, wins, losses, habits and milestones are written to Walrus Memory. That makes them durable, encrypted and recallable.",
  },
  {
    kicker: "03 · Talk",
    title: "Ask it why you did that",
    body: "Chat with your twin, get your Wallet Wrapped, publish it to the leaderboard, or paper-copy someone else's twin. It's all simulated, with no real funds.",
  },
] as const;

export default function Home() {
  return (
    <main>
      <section
        aria-labelledby="hero-heading"
        className="mx-auto max-w-6xl px-4 pb-[var(--space-section)] pt-10 sm:px-8"
      >
        <p className="flex justify-between border-b border-ink pb-2 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-ink-soft">
          <span>Vol. 1 · Total Recall edition</span>
          <span>Sui mainnet</span>
        </p>
        <h1
          id="hero-heading"
          className="mt-8 max-w-5xl font-display text-hero font-black leading-[0.92] tracking-[-0.03em] [font-variation-settings:'opsz'_144,'SOFT'_50]"
        >
          Your wallet has a memory.{" "}
          <em className="font-light italic text-signal">Meet the twin</em> that kept it.
        </h1>
        <div className="mt-10 grid gap-8 border-t border-rule pt-6 sm:grid-cols-[1.4fr_1fr]">
          <p className="max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
            Connect a Sui wallet and sign one message, which costs no gas. WalletTwin turns your
            on-chain history into an AI twin you can question: why you sold, what your worst habit
            is, and when you were at your best.
          </p>
          <p className="self-end font-mono text-xs uppercase leading-6 tracking-widest text-ink-soft">
            Connect &amp; sign in from the top-right corner. Your twin is private until you choose
            to publish it.
          </p>
        </div>
      </section>

      <section aria-labelledby="how-heading" className="border-y-2 border-ink bg-paper-deep/60">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
          <h2 id="how-heading" className="sr-only">
            How it works
          </h2>
          <ol className="grid gap-px bg-ink/80 sm:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.kicker} className="bg-paper p-6">
                <p className="font-mono text-xs uppercase tracking-widest text-signal">{step.kicker}</p>
                <h3 className="mt-3 font-display text-2xl font-semibold leading-tight">{step.title}</h3>
                <p className="mt-3 leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="top-twins-heading" className="mx-auto max-w-6xl px-4 py-[var(--space-section)] sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="top-twins-heading" className="font-display text-3xl font-bold">
            Top twins
          </h2>
          <Link
            href="/leaderboard"
            className="font-mono text-xs uppercase tracking-widest text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            Full leaderboard →
          </Link>
        </div>
        <Suspense fallback={<p className="mt-6 text-ink-soft">Loading the board…</p>}>
          <TopTwins />
        </Suspense>
      </section>
    </main>
  );
}

async function TopTwins() {
  await connection();
  return <LeaderboardTable rows={await getLeaderboard(5)} compact />;
}
