import Link from "next/link";
import { Suspense } from "react";
import { NavLinks, NavList } from "@/components/layout/NavLinks";
import { WalletControls } from "@/components/wallet/WalletControls";

export function SiteHeader() {
  return (
    <header className="border-b-2 border-ink">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-8">
        <Link
          href="/"
          className="font-display text-2xl font-black tracking-tight [font-variation-settings:'SOFT'_100]"
        >
          Wallet<span className="text-signal">Twin</span>
        </Link>
        <nav aria-label="Main navigation" className="order-3 w-full sm:order-none sm:w-auto">
          <Suspense fallback={<NavList activePath={null} />}>
            <NavLinks />
          </Suspense>
        </nav>
        <WalletControls />
      </div>
    </header>
  );
}
