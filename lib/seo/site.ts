import type { Metadata } from "next";

/**
 * How WalletTwin describes itself to search engines, AI answer engines and link previews.
 * Every page's metadata, the sitemap, robots.txt, llms.txt and JSON-LD read from here.
 */
export const SITE = {
  name: "WalletTwin",
  title: "WalletTwin — your Sui wallet, remembered",
  tagline: "Your wallet has a memory. Meet the twin that kept it.",
  imageAlt: "WalletTwin: Your wallet has a memory. Meet the twin that kept it.",
  description:
    "Turn your Sui on-chain history into an AI twin with memory: chat with it, get your Wallet Wrapped, and let others paper-copy your trades.",
  keywords: [
    "Sui wallet",
    "Sui wallet analytics",
    "AI wallet twin",
    "on-chain trading history",
    "crypto trading journal",
    "Wallet Wrapped",
    "copy trading",
    "paper trading",
    "Walrus Memory",
    "Tatum",
    "MCP server",
  ],
  locale: "en_US",
  /** Mirrors --color-paper and --color-signal in app/globals.css. */
  backgroundColor: "#060911",
  accentColor: "#FAE91D",
} as const;

const FALLBACK_URL = "http://localhost:3000";

/** The public origin. NEXT_PUBLIC_APP_URL is a build arg, so this is fixed per image. */
export function siteUrl(): URL {
  return new URL(process.env.NEXT_PUBLIC_APP_URL || FALLBACK_URL);
}

export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl()).toString();
}

/** Pages that only make sense for their signed-in owner (or a private share link). */
export const NOINDEX: Metadata["robots"] = { index: false, follow: false };

/**
 * Open Graph fields every page shares. A page that sets `openGraph` replaces the parent's
 * object instead of merging it, so pages spread this in.
 */
export const BASE_OPEN_GRAPH = {
  siteName: SITE.name,
  locale: SITE.locale,
  type: "website",
} as const;

/** The site card from app/opengraph-image.tsx. */
export const SITE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: SITE.imageAlt,
} as const;

/**
 * Metadata for an indexable page: its canonical URL plus matching Open Graph and X cards.
 * The site card is listed explicitly because a page's `openGraph` drops the parent's image.
 */
export function pageMetadata(page: { title: string; description: string; path: string; shareTitle?: string }): Metadata {
  const shareTitle = page.shareTitle ?? page.title;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.path },
    openGraph: { ...BASE_OPEN_GRAPH, title: shareTitle, description: page.description, url: page.path, images: [SITE_IMAGE] },
    twitter: { card: "summary_large_image", title: shareTitle, description: page.description, images: [SITE_IMAGE] },
  };
}

/** JSON for a `<script type="application/ld+json">`. Escaping `<` keeps data from closing the tag. */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
