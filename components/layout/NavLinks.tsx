"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/twin/me", label: "My twin" },
  { href: "/wrapped", label: "Wrapped" },
  { href: "/portfolio", label: "Paper portfolio" },
  { href: "/connect", label: "Agents" },
] as const;

/** Active-link styling needs the request path, so this suspends during prerender. */
export function NavLinks() {
  return <NavList activePath={usePathname()} />;
}

/** Plain list: also the Suspense fallback, rendered without an active link. */
export function NavList({ activePath }: { activePath: string | null }) {
  return (
    <ul className="flex flex-wrap gap-x-1 gap-y-1 font-mono text-[0.72rem] uppercase tracking-[0.18em]">
      {NAV_LINKS.map((link) => {
        const isActive = activePath === link.href;
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={`group relative block px-2.5 py-1.5 transition-colors duration-150 ${
                isActive ? "text-signal" : "text-ink-soft hover:text-ink"
              }`}
            >
              <span
                aria-hidden
                className={`absolute inset-x-2.5 bottom-0 h-0.5 origin-left bg-signal transition-transform duration-300 ease-[var(--ease-out-expo)] ${
                  isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                }`}
              />
              <span className="sandy-group inline-block">{link.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
