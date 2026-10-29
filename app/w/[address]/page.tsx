import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { parseSuiAddress } from "@/lib/auth/message";
import { env } from "@/lib/env";
import { BASE_OPEN_GRAPH, NOINDEX } from "@/lib/seo/site";
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
  // Share links carry a secret token: previews yes, search results no.
  if (!shared) return { robots: NOINDEX };
  const title = "Wallet Wrapped";
  const description = "A Sui wallet's year on-chain, remembered by its AI twin.";
  const image = { url: shared.imageUrl, width: 1200, height: 630, alt: "Wallet Wrapped card with trading stats" };
  return {
    title,
    description,
    robots: NOINDEX,
    openGraph: { ...BASE_OPEN_GRAPH, title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
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
      <p className="kicker">Shared Wallet Wrapped</p>
      <figure className="hud-frame rise mt-6 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shared.imageUrl}
          alt="Wallet Wrapped card"
          width={1200}
          height={630}
          className="h-auto w-full border border-rule"
        />
      </figure>
      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Link href="/" className="btn btn-volt">
          Make your own twin →
        </Link>
        <p className="text-sm text-ink-soft">Estimates from on-chain data. Not financial advice.</p>
      </div>
    </>
  );
}
