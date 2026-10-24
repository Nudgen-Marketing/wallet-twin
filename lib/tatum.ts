import "server-only";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { env } from "@/lib/env";

/**
 * The only module that talks to Tatum. Everything Sui-related on the server goes
 * through Tatum's Sui gateway (GraphQL; Sui retired JSON-RPC on mainnet in Jul 2026).
 * Docs: https://docs.tatum.io/reference/rpc-sui
 */

export type SuiNetwork = "mainnet" | "testnet";

const TATUM_SUI_GRAPHQL_URLS: Record<SuiNetwork, string> = {
  mainnet: "https://sui-mainnet.gateway.tatum.io/graphql",
  testnet: "https://sui-testnet.gateway.tatum.io/graphql",
};

export function tatumSuiGraphQLUrl(network: SuiNetwork): string {
  return TATUM_SUI_GRAPHQL_URLS[network];
}

function tatumHeaders(): Record<string, string> {
  const apiKey = env().TATUM_API_KEY;
  // The gateway serves anonymous queries at a lower limit; send the key when we have one.
  return apiKey ? { "x-api-key": apiKey } : {};
}

let client: SuiGraphQLClient | undefined;

/**
 * Sui client backed by Tatum's GraphQL gateway. Used for signature verification
 * (zkLogin wallets need on-chain JWK lookups) and, from step 2, history reads.
 */
export function tatumSuiClient(): SuiGraphQLClient {
  if (!client) {
    const network = env().NEXT_PUBLIC_SUI_NETWORK;
    client = new SuiGraphQLClient({
      url: tatumSuiGraphQLUrl(network),
      network,
      headers: tatumHeaders(),
    });
  }
  return client;
}
