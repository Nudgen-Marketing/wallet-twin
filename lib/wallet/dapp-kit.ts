import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";

/**
 * Browser-side wallet kit. It only connects wallets and signs the sign-in message,
 * so it talks to the public Sui fullnode; all data reads happen server-side through
 * Tatum (lib/tatum.ts), which keeps the Tatum API key off the client.
 */

type SuiNetwork = "mainnet" | "testnet";

const NETWORK: SuiNetwork = process.env.NEXT_PUBLIC_SUI_NETWORK === "testnet" ? "testnet" : "mainnet";

const PUBLIC_GRPC_URLS: Record<SuiNetwork, string> = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
};

export const dAppKit = createDAppKit({
  networks: [NETWORK],
  defaultNetwork: NETWORK,
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: PUBLIC_GRPC_URLS[network] }),
  // Dev-only throwaway wallet so sign-in can be exercised without a browser extension.
  enableBurnerWallet: process.env.NODE_ENV === "development",
});

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
