import "server-only";
import { parseSuiAddress } from "@/lib/auth/message";
import { env } from "@/lib/env";

/**
 * Seeded mainnet wallets judges can explore without connecting a wallet.
 * Picked 2026-10-24 by scanning recent Sui activity through Tatum; override with
 * DEMO_WALLETS (comma-separated) to use curated wallets instead.
 */
const DEFAULT_DEMO_WALLETS: { address: string; label: string }[] = [
  {
    address: "0x854b8c1993e4396468f166a628e9926a2b18b398f104d8d3046c67bc32a2c940",
    label: "The MAGMA scalper",
  },
  {
    address: "0x4999139366a0c303b7cf1e683d24d1d8adb0de38e342fdfdee8788f8d1976c58",
    label: "The occasional DeFi saver",
  },
];

export interface DemoWallet {
  address: string;
  label: string;
}

export function demoWallets(): DemoWallet[] {
  const configured = env().DEMO_WALLETS?.split(",").map((value) => parseSuiAddress(value)).filter(Boolean) as string[] | undefined;
  if (!configured || configured.length === 0) return DEFAULT_DEMO_WALLETS;
  return configured.map((address, index) => ({
    address,
    label: DEFAULT_DEMO_WALLETS.find((wallet) => wallet.address === address)?.label ?? `Demo wallet ${index + 1}`,
  }));
}

export function isDemoWallet(address: string): boolean {
  return demoWallets().some((wallet) => wallet.address === address);
}
