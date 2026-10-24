"use client";

import dynamic from "next/dynamic";

// Wallets are discovered through `window` (Wallet Standard), so the panel never renders on the server.
export const WalletControls = dynamic(
  () => import("@/components/wallet/WalletPanel").then((mod) => mod.WalletPanel),
  {
    ssr: false,
    loading: () => (
      <span className="inline-block h-10 w-36 animate-pulse rounded-sm bg-paper-deep" aria-hidden />
    ),
  },
);
