import type { SuiTransaction } from "@/lib/tatum/types";
import type { ValuedActivity, ValuedLeg } from "@/lib/trades/types";

export const ME = `0x${"a".repeat(64)}`;
export const FRIEND = `0x${"b".repeat(64)}`;
export const POOL = `0x${"c".repeat(64)}`;
export const SUI = `0x${"0".repeat(63)}2::sui::SUI`;
export const USDC = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
export const MEME = `0x${"d".repeat(64)}::meme::MEME`;

export function suiTx(overrides: Partial<SuiTransaction> = {}): SuiTransaction {
  return {
    digest: "D1",
    sender: ME,
    checkpoint: 100,
    timestampMs: 1_790_000_000_000,
    succeeded: true,
    gasCostMist: "1000",
    balanceChanges: [],
    objectChanges: [],
    moveCalls: [],
    isTruncated: false,
    ...overrides,
  };
}

export function leg(coinType: string, amount: number, usd: number | null, symbol = coinType.split("::").at(-1)!): ValuedLeg {
  return { coinType, raw: "0", symbol, amount, usd };
}

let sequence = 0;
export function swap(
  atMs: number,
  out: ValuedLeg,
  received: ValuedLeg,
  usdValue: number | null = out.usd ?? received.usd,
): ValuedActivity {
  sequence += 1;
  return {
    digest: `S${sequence}`,
    checkpoint: sequence,
    timestampMs: atMs,
    kind: "swap",
    legsOut: [out],
    legsIn: [received],
    gasMist: "0",
    counterparty: null,
    nftTypes: [],
    entrypoint: "router::swap",
    usdValue,
  };
}
