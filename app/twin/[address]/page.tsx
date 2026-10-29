import { formatAddress } from "@mysten/sui/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { FollowButton } from "@/components/copy/FollowButton";
import { ProfileQuote } from "@/components/twin/ProfileQuote";
import { StatsPanel } from "@/components/twin/StatsPanel";
import { TwinChat } from "@/components/twin/TwinChat";
import { parseSuiAddress } from "@/lib/auth/message";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { BASE_OPEN_GRAPH, NOINDEX } from "@/lib/seo/site";
import { describeTwin, loadTwinSeo, twinTitle } from "@/lib/seo/twin";
import { loadPublicTwin } from "@/lib/twin/public";

const SUGGESTIONS = [
  "How would you describe your trading style?",
  "What's your best trade ever?",
  "What's your biggest weakness as a trader?",
];

export async function generateMetadata(props: PageProps<"/twin/[address]">): Promise<Metadata> {
  const address = parseSuiAddress((await props.params).address);
  const twin = address ? await loadTwinSeo(address) : null;
  if (!address || !twin) return { title: "Twin not found", robots: NOINDEX };

  const title = twinTitle(address);
  const description = describeTwin(twin);
  const path = `/twin/${address}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    // The preview image comes from the colocated opengraph-image.tsx.
    openGraph: { ...BASE_OPEN_GRAPH, type: "profile", title: `${title} · WalletTwin`, description, url: path },
    twitter: { card: "summary_large_image", title: `${title} · WalletTwin`, description },
  };
}

export default function PublicTwinPage(props: PageProps<"/twin/[address]">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <p className="kicker">Public twin</p>
      <Suspense fallback={<p className="mt-6 text-ink-soft">Finding this twin…</p>}>
        <PublicTwin params={props.params} />
      </Suspense>
    </main>
  );
}

async function PublicTwin({ params }: { params: PageProps<"/twin/[address]">["params"] }) {
  // Twin memories are recalled live from Walrus Memory: request-time work, never prerendered.
  await connection();
  const address = parseSuiAddress((await params).address);
  const twin = address ? await loadPublicTwin(address) : null;
  if (!address || !twin) notFound();
  const session = await getSession();
  const follow = session
    ? await db.follow.findUnique({ where: { follower_leader: { follower: session.address, leader: address } } })
    : null;

  return (
    <>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <h1 className="fringe font-display text-5xl font-bold uppercase tracking-tight">
          Twin of <span className="block font-mono text-3xl font-medium normal-case text-signal sm:inline sm:text-4xl">{formatAddress(address)}</span>
        </h1>
        <FollowButton
          leader={address}
          initialFollowing={Boolean(follow?.active)}
          isSignedIn={Boolean(session)}
          isOwner={session?.address === address}
        />
      </div>

      {/* Mobile reads profile → chat → stats; desktop keeps the chat pinned beside everything else. */}
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr]">
        {twin.profile && (
          <div className="lg:col-start-1">
            <ProfileQuote profile={twin.profile} />
          </div>
        )}
        <div className="lg:sticky lg:top-36 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <TwinChat
            api={`/api/twin/${address}/chat`}
            audience="public"
            suggestions={SUGGESTIONS}
            twinName={`Twin ${formatAddress(address)}`}
          />
        </div>
        <div className="space-y-10 lg:col-start-1">
          <StatsPanel stats={twin.stats} historyFromMs={twin.historyFromMs} />
          <MemoryList title="Insights" items={twin.insights} empty="No insights yet." />
          <MemoryList title="Milestones" items={twin.milestones} empty="No milestones yet." />
        </div>
      </div>
    </>
  );
}

function MemoryList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section>
      <h2 className="hud-label">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-ink-soft">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item} className="reveal border-l-2 border-cyan bg-paper-deep/60 py-2 pl-4 pr-3 leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
