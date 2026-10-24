import { formatAddress } from "@mysten/sui/utils";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FollowButton } from "@/components/copy/FollowButton";
import { StatsPanel } from "@/components/twin/StatsPanel";
import { TwinChat } from "@/components/twin/TwinChat";
import { parseSuiAddress } from "@/lib/auth/message";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { loadPublicTwin } from "@/lib/twin/public";

const SUGGESTIONS = [
  "How would you describe your trading style?",
  "What's your best trade ever?",
  "What's your biggest weakness as a trader?",
];

export default function PublicTwinPage(props: PageProps<"/twin/[address]">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
      <p className="font-mono text-xs uppercase tracking-widest text-signal">Public twin</p>
      <Suspense fallback={<p className="mt-6 text-ink-soft">Finding this twin…</p>}>
        <PublicTwin params={props.params} />
      </Suspense>
    </main>
  );
}

async function PublicTwin({ params }: { params: PageProps<"/twin/[address]">["params"] }) {
  const address = parseSuiAddress((await params).address);
  const twin = address ? await loadPublicTwin(address) : null;
  if (!address || !twin) notFound();
  const session = await getSession();
  const follow = session
    ? await db.follow.findUnique({ where: { follower_leader: { follower: session.address, leader: address } } })
    : null;

  return (
    <>
      <h1 className="mt-3 font-display text-5xl font-black tracking-tight sm:text-6xl">
        Twin of <span className="font-mono text-3xl font-medium sm:text-4xl">{formatAddress(address)}</span>
      </h1>
      {twin.profile && (
        <p className="mt-6 max-w-3xl font-display text-2xl leading-snug sm:text-3xl">
          <span className="text-signal">“</span>
          {twin.profile}
          <span className="text-signal">”</span>
        </p>
      )}

      <div className="mt-8">
        <FollowButton
          leader={address}
          initialFollowing={Boolean(follow?.active)}
          isSignedIn={Boolean(session)}
          isOwner={session?.address === address}
        />
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-10">
          <StatsPanel stats={twin.stats} historyFromMs={twin.historyFromMs} />
          <MemoryList title="Insights" items={twin.insights} empty="No insights yet." />
          <MemoryList title="Milestones" items={twin.milestones} empty="No milestones yet." />
        </div>
        <TwinChat
          api={`/api/twin/${address}/chat`}
          audience="public"
          suggestions={SUGGESTIONS}
          twinName={`Twin ${formatAddress(address)}`}
        />
      </div>
    </>
  );
}

function MemoryList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section>
      <h2 className="font-mono text-xs uppercase tracking-widest text-signal">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-ink-soft">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item} className="border-l-4 border-ink pl-3 leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
