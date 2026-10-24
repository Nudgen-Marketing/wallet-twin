import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { parseSuiAddress } from "@/lib/auth/message";
import { env } from "@/lib/env";
import { isValidWrappedToken, wrappedImagePath } from "@/lib/wrapped/share";

/** Public landing page for a shared Wrapped card (only reachable with the owner's link). */

type Props = PageProps<"/w/[address]">;

async function resolve(props: Props): Promise<{ address: string; imageUrl: string } | null> {
  const [{ address: raw }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const address = parseSuiAddress(raw);
  const token = typeof searchParams.t === "string" ? searchParams.t : null;
  if (!address || !isValidWrappedToken(address, token)) return null;
  return { address, imageUrl: new URL(wrappedImagePath(address), env().NEXT_PUBLIC_APP_URL).toString() };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const shared = await resolve(props);
  if (!shared) return { title: "WalletTwin" };
  return {
    title: "Wallet Wrapped · WalletTwin",
    description: "A Sui wallet's year on-chain, remembered by its AI twin.",
    openGraph: { images: [{ url: shared.imageUrl, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [shared.imageUrl] },
  };
}

export default function SharedWrappedPage(props: Props) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-8">
      <Suspense fallback={<p className="text-ink-soft">Unwrapping…</p>}>
        <SharedWrapped {...props} />
      </Suspense>
    </main>
  );
}

async function SharedWrapped(props: Props) {
  const shared = await resolve(props);
  if (!shared) notFound();
  return (
    <>
      <p className="font-mono text-xs uppercase tracking-widest text-signal">Shared Wallet Wrapped</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={shared.imageUrl}
        alt="Wallet Wrapped card"
        width={1200}
        height={630}
        className="mt-6 h-auto w-full border-2 border-ink shadow-[8px_8px_0_var(--ink)]"
      />
      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Link
          href="/"
          className="rounded-sm bg-signal px-5 py-3 font-mono text-sm uppercase tracking-widest text-signal-ink shadow-[3px_3px_0_var(--ink)]"
        >
          Make your own twin →
        </Link>
        <p className="text-sm text-ink-soft">Estimates from on-chain data. Not financial advice.</p>
      </div>
    </>
  );
}
