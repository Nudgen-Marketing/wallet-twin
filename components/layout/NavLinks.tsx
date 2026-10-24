"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/twin/me", label: "My twin" },
  { href: "/wrapped", label: "Wrapped" },
  { href: "/portfolio", label: "Paper portfolio" },
] as const;

/** Active-link styling needs the request path, so this suspends during prerender. */
export function NavLinks() {
  return <NavList activePath={usePathname()} />;
}

/** Plain list: also the Suspense fallback, rendered without an active link. */
export function NavList({ activePath }: { activePath: string | null }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs uppercase tracking-widest text-ink-soft">
      {NAV_LINKS.map((link) => {
        const isActive = activePath === link.href;
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={`underline-offset-4 transition-colors duration-150 hover:text-ink hover:underline hover:decoration-signal hover:decoration-2 ${
                isActive ? "text-ink underline decoration-signal decoration-2" : ""
              }`}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
