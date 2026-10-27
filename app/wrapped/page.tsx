import Link from "next/link";
import { Suspense } from "react";
import { WrappedActions } from "@/components/wrapped/WrappedActions";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { buildWrappedCard, wrappedShareText } from "@/lib/wrapped/data";
import { wrappedImagePath, wrappedSharePath } from "@/lib/wrapped/share";

export default function WrappedPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-8">
      <p className="kicker">Wallet Wrapped</p>
      <Suspense fallback={<p className="mt-6 text-ink-soft">Wrapping…</p>}>
        <MyWrapped />
      </Suspense>
    </main>
  );
}

async function MyWrapped() {
  const session = await getSession();
  if (!session) {
    return <p className="mt-6 text-lg text-ink-soft">Connect your wallet and sign in (top right) to get your Wrapped.</p>;
  }
  const state = await db.syncState.findUnique({ where: { address: session.address } });
  if (!state) {
    return (
      <p className="mt-6 text-lg text-ink-soft">
        <Link href="/sync" className="link-volt">
          Sync your wallet
        </Link>{" "}
        first. Your Wrapped is made from your history.
      </p>
    );
  }

  const card = await buildWrappedCard(session.address);
  const imagePath = wrappedImagePath(session.address);
  const shareUrl = new URL(wrappedSharePath(session.address), env().NEXT_PUBLIC_APP_URL).toString();

  return (
    <>
      <h1 className="mt-3 fringe font-display text-5xl font-bold uppercase tracking-tight sm:text-6xl">Your year on-chain, so far</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-soft">
        Built from your Sui history (via Tatum) and your twin&apos;s memory. Anyone with the share link can see this
        card, and nothing else about your twin.
      </p>
      <figure className="hud-frame rise mt-10 p-3">
        {/* Generated PNG from our own route; next/image adds nothing for a dynamic OG image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagePath}
          alt={`Wallet Wrapped: ${wrappedShareText(card)}`}
          width={1200}
          height={630}
          className="h-auto w-full border border-rule"
        />
      </figure>
      <div className="mt-10">
        <WrappedActions imagePath={imagePath} shareUrl={shareUrl} shareText={wrappedShareText(card)} />
      </div>
    </>
  );
}
