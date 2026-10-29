import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DemoTwins } from "@/components/demo/DemoTwins";
import { FloodBand } from "@/components/hero/FloodBand";
import { TwinScope } from "@/components/hero/TwinScope";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { BASE_OPEN_GRAPH, SITE } from "@/lib/seo/site";
import { getLeaderboard } from "@/lib/twin/publish";
import { stagger } from "@/lib/ui/stagger";

// The title is the layout's default; the preview image is the colocated opengraph-image.tsx.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { ...BASE_OPEN_GRAPH, title: SITE.title, description: SITE.description, url: "/" },
};

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
        className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-[var(--space-section)] pt-12 sm:px-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:pt-20"
      >
        <div>
          <p className="rise kicker">Sui mainnet · Total Recall build</p>
          <h1
            id="hero-heading"
            style={stagger(1)}
            className="rise fringe sandevistan mt-6 font-display text-hero font-bold uppercase leading-[0.9] tracking-[-0.02em]"
          >
            Your wallet has a memory.{" "}
            <span className="glitch text-signal" data-text="Meet the twin">
              Meet the twin
            </span>{" "}
            that kept it.
          </h1>
          <p
            style={stagger(2)}
            className="rise mt-8 max-w-xl border-l-2 border-signal pl-5 text-lg leading-relaxed text-ink-soft sm:text-xl"
          >
            Connect a Sui wallet and sign one message, which costs no gas. WalletTwin turns your
            on-chain history into an AI twin you can question: why you sold, what your worst habit
            is, and when you were at your best.
          </p>
          <div style={stagger(3)} className="rise mt-10 flex flex-wrap items-center gap-4">
            <Link href="/leaderboard" className="btn btn-volt">
              Browse public twins →
            </Link>
            <a href="#how-heading" className="btn btn-ghost">
              How it works
            </a>
          </div>
          <p
            style={stagger(4)}
            className="rise cursor-blink mt-6 font-mono text-xs uppercase leading-6 tracking-[0.18em] text-ink-soft"
          >
            Connect &amp; sign in from the top-right corner. Your twin is private until you choose
            to publish it.
          </p>
        </div>
        <div style={stagger(2)} className="rise">
          <TwinScope />
        </div>
      </section>

      <FloodBand />

      <Suspense fallback={null}>
        <DemoTwins />
      </Suspense>

      <section aria-labelledby="how-heading" className="relative scroll-mt-28 border-y border-rule bg-paper-deep/50">
        <div className="mx-auto max-w-6xl px-4 py-[var(--space-section)] sm:px-8">
          <p className="kicker">Protocol</p>
          <h2 id="how-heading" className="fringe mt-4 font-display text-4xl font-bold uppercase tracking-tight sm:text-5xl">
            How it works
          </h2>
          <ol className="mt-10 grid gap-5 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.kicker}
                className={`reveal panel panel-interactive p-6 ${index === 1 ? "sm:translate-y-8" : ""}`}
              >
                <p className="numeral-outline font-display text-6xl font-bold leading-none">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <p className="mt-5 font-mono text-xs uppercase tracking-[0.2em] text-signal">{step.kicker}</p>
                <h3 className="mt-2 font-display text-2xl font-semibold leading-tight">{step.title}</h3>
                <p className="mt-3 leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="top-twins-heading" className="mx-auto max-w-6xl px-4 py-[var(--space-section)] sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="kicker">Ranked by paper-copy return</p>
            <h2 id="top-twins-heading" className="fringe mt-4 font-display text-4xl font-bold uppercase tracking-tight sm:text-5xl">
              Top twins
            </h2>
          </div>
          <Link href="/leaderboard" className="btn btn-ghost btn-sm">
            Full leaderboard →
          </Link>
        </div>
        <Suspense fallback={<p className="mt-6 font-mono text-sm text-ink-soft">Loading the board…</p>}>
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
