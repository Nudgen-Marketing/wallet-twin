import "server-only";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { env, requireSecret } from "@/lib/env";
import {
  fetchAddressHistory,
  type FetchHistoryOptions,
  type FetchHistoryResult,
  type HistorySource,
} from "@/lib/tatum/history";
import { createRateGate, createTatumHttp } from "@/lib/tatum/http";
import { createTatumPrices, type CandleInterval } from "@/lib/tatum/prices";
import { createTatumSuiGraphQL, type TatumSuiGraphQL } from "@/lib/tatum/sui-graphql";
import { createTatumSuiGrpc } from "@/lib/tatum/sui-grpc";
import type { CoinInfo, HistoryRange, UsdPrice } from "@/lib/tatum/types";

/**
 * The only entry point that talks to Tatum. Sui reads go through Tatum's Sui gateway
 * (GraphQL; Sui retired JSON-RPC on mainnet in Jul 2026), prices through Tatum's
 * Data API. Docs: https://docs.tatum.io/reference/rpc-sui
 */

export type { CoinInfo, HistoryRange, SuiTransaction, UsdPrice } from "@/lib/tatum/types";
export type { FetchHistoryOptions, FetchHistoryResult } from "@/lib/tatum/history";

export type SuiNetwork = "mainnet" | "testnet";

const TATUM_SUI_GRAPHQL_URLS: Record<SuiNetwork, string> = {
  mainnet: "https://sui-mainnet.gateway.tatum.io/graphql",
  testnet: "https://sui-testnet.gateway.tatum.io/graphql",
};

const TATUM_SUI_GRPC_HOSTS: Record<SuiNetwork, string> = {
  mainnet: "sui-mainnet-grpc.gateway.tatum.io:443",
  testnet: "sui-testnet-grpc.gateway.tatum.io:443",
};

export function tatumSuiGraphQLUrl(network: SuiNetwork): string {
  return TATUM_SUI_GRAPHQL_URLS[network];
}

// One gate per process: every Tatum call (HTTP and gRPC) shares the plan's 3 req/s.
const gate = createRateGate();
const http = createTatumHttp({ gate });

let graphql: TatumSuiGraphQL | undefined;
function suiGraphQL(): TatumSuiGraphQL {
  graphql ??= createTatumSuiGraphQL({
    url: tatumSuiGraphQLUrl(env().NEXT_PUBLIC_SUI_NETWORK),
    apiKey: env().TATUM_API_KEY,
    http,
  });
  return graphql;
}

let grpcHistory: HistorySource | undefined;
function historySource(): HistorySource {
  if (env().TATUM_SUI_HISTORY_SOURCE === "graphql") return suiGraphQL();
  grpcHistory ??= createTatumSuiGrpc({
    host: TATUM_SUI_GRPC_HOSTS[env().NEXT_PUBLIC_SUI_NETWORK],
    apiKey: requireSecret("TATUM_API_KEY"),
    gate,
  });
  return grpcHistory;
}

/** Newest-first walk of an address's history, capped; returned oldest-first. */
export function getAddressHistory(
  address: string,
  options?: FetchHistoryOptions,
): Promise<FetchHistoryResult> {
  return fetchAddressHistory(historySource(), address, options);
}

/**
 * How far back address history goes with the configured source. gRPC serves the full
 * node index (~9 months); GraphQL's address filter only the last ~90 days.
 */
export function getHistoryRange(): Promise<HistoryRange | null> {
  return suiGraphQL().historyRange({ addressFiltered: env().TATUM_SUI_HISTORY_SOURCE === "graphql" });
}

export function getCoinInfo(coinType: string): Promise<CoinInfo> {
  return suiGraphQL().coinInfo(coinType);
}

/** Historical USD price via Tatum OHLCV (50 credits/call: cache the result). */
export function getUsdPriceAt(
  symbol: string,
  atMs: number,
  interval?: CandleInterval,
): Promise<UsdPrice | null> {
  return createTatumPrices({ apiKey: requireSecret("TATUM_API_KEY"), http }).usdPriceAt(
    symbol,
    atMs,
    interval,
  );
}

let sdkClient: SuiGraphQLClient | undefined;

/**
 * @mysten/sui client on Tatum's GraphQL gateway, for SDK features that need a
 * client (zkLogin signature verification).
 */
export function tatumSuiClient(): SuiGraphQLClient {
  if (!sdkClient) {
    const { NEXT_PUBLIC_SUI_NETWORK: network, TATUM_API_KEY: apiKey } = env();
    sdkClient = new SuiGraphQLClient({
      url: tatumSuiGraphQLUrl(network),
      network,
      headers: apiKey ? { "x-api-key": apiKey } : {},
    });
  }
  return sdkClient;
}
