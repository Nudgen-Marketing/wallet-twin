import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { NavLinks, NavList } from "@/components/layout/NavLinks";
import { StatusTicker } from "@/components/layout/StatusTicker";
import { WalletControls } from "@/components/wallet/WalletControls";

export function SiteHeader() {
  return (
    <header className="relative z-40 border-b border-rule bg-paper/85 backdrop-blur-md sm:sticky sm:top-0">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="WalletTwin home">
          <BrandMark className="size-10 shrink-0 overflow-visible" />
          <span className="fringe sandy-group inline-block -skew-x-12 font-display text-xl font-bold uppercase tracking-[0.08em] text-signal">
            Wallet<span className="text-ink">{"//"}</span>Twin
          </span>
        </Link>
        <nav aria-label="Main navigation" className="order-3 w-full sm:order-none sm:w-auto">
          <Suspense fallback={<NavList activePath={null} />}>
            <NavLinks />
          </Suspense>
        </nav>
        <WalletControls />
      </div>
      <StatusTicker />
      {/* Yellow signal rail under the header. */}
      <div aria-hidden className="h-0.5 bg-gradient-to-r from-signal via-signal/40 to-transparent" />
    </header>
  );
}
