/** A wallet's on-chain actions after classification. Raw amounts are integer strings. */

export type ActivityKind =
  | "swap"
  | "transfer_in"
  | "transfer_out"
  | "deposit"
  | "withdraw"
  | "nft_buy"
  | "nft_sell"
  | "nft_mint"
  | "nft_received"
  | "nft_sent"
  | "stake"
  | "unstake"
  | "other"
  | "failed";

export interface Leg {
  coinType: string;
  /** Positive raw amount in the coin's smallest unit. */
  raw: string;
}

export interface ParsedActivity {
  digest: string;
  checkpoint: number;
  timestampMs: number;
  kind: ActivityKind;
  /** Coins the wallet gave up (gas excluded). */
  legsOut: Leg[];
  /** Coins the wallet received. */
  legsIn: Leg[];
  gasMist: string;
  /** Other side of a plain transfer, when identifiable. */
  counterparty: string | null;
  /** Move types of collectibles that moved in or out. */
  nftTypes: string[];
  /** `module::function` of the first Move call, for "which protocol" hints. */
  entrypoint: string | null;
}

export interface ValuedLeg extends Leg {
  symbol: string | null;
  /** Human units (raw / 10^decimals); null when decimals are unknown. */
  amount: number | null;
  /** USD value at transaction time; null when no reliable price exists. */
  usd: number | null;
}

export interface ValuedActivity extends Omit<ParsedActivity, "legsOut" | "legsIn"> {
  legsOut: ValuedLeg[];
  legsIn: ValuedLeg[];
  /** Trade value in USD (fully priced side of a swap), or null if unknown. */
  usdValue: number | null;
}
