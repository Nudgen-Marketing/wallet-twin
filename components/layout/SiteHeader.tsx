import Link from "next/link";
import { WalletControls } from "@/components/wallet/WalletControls";

const NAV_LINKS = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/twin/me", label: "My twin" },
  { href: "/portfolio", label: "Paper portfolio" },
] as const;

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
          <ul className="flex gap-5 font-mono text-xs uppercase tracking-widest text-ink-soft">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="transition-colors duration-150 hover:text-ink hover:underline hover:decoration-signal hover:decoration-2 hover:underline-offset-4"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <WalletControls />
      </div>
    </header>
  );
}
