"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Wallets are discovered through `window` (Wallet Standard), so the panel never renders on
// the server. `ssr: false` suspends during prerender; the boundary supplies the shell.
const WalletPanel = dynamic(() => import("@/components/wallet/WalletPanel").then((mod) => mod.WalletPanel), {
  ssr: false,
});

export function WalletControls() {
  return (
    <Suspense fallback={<span className="scan-bar inline-block h-10 w-36 bg-paper-deep" aria-hidden />}>
      <WalletPanel />
    </Suspense>
  );
}
