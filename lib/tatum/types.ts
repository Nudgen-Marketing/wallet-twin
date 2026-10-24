/**
 * Transport-agnostic shapes returned by lib/tatum. Raw on-chain integers stay as
 * decimal strings (they routinely exceed Number.MAX_SAFE_INTEGER).
 */

export interface SuiBalanceChange {
  /** Address whose balance changed; null for object-owned or shared balances. */
  owner: string | null;
  /** Normalized struct tag, e.g. 0x000…0002::sui::SUI. */
  coinType: string;
  /** Signed raw amount in the coin's smallest unit. */
  amount: string;
}

export interface SuiObjectChange {
  objectId: string;
  /** Normalized Move type of the object, when it is a Move object. */
  objectType: string | null;
  created: boolean;
  deleted: boolean;
  ownerBefore: string | null;
  ownerAfter: string | null;
}

export interface SuiMoveCall {
  package: string;
  module: string;
  function: string;
}

export interface SuiTransaction {
  digest: string;
  sender: string | null;
  checkpoint: number;
  timestampMs: number;
  succeeded: boolean;
  /** computation + storage − rebate, in MIST. */
  gasCostMist: string;
  balanceChanges: SuiBalanceChange[];
  objectChanges: SuiObjectChange[];
  moveCalls: SuiMoveCall[];
  /** True when nested lists hit their page cap and were cut short. */
  isTruncated: boolean;
}

export interface HistoryRange {
  firstCheckpoint: number;
  firstTimestampMs: number;
  lastCheckpoint: number;
  lastTimestampMs: number;
}

export interface CoinInfo {
  coinType: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
}

export interface UsdPrice {
  symbol: string;
  usd: number;
  candleOpenMs: number;
  candleCloseMs: number;
}
