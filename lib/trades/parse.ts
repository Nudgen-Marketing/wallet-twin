import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { SuiTransaction } from "@/lib/tatum/types";
import type { ActivityKind, Leg, ParsedActivity } from "@/lib/trades/types";

/**
 * Classifies one transaction from the point of view of `owner`, using only what the
 * chain reports: the owner's net balance changes (gas removed), object ownership
 * moves and the Move entrypoints called. Heuristic by design; see the README for limits.
 */

const SUI_SYSTEM = normalizeSuiAddress("0x3");
const SUI_COIN = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";

/** Object types that move with DeFi/plumbing activity and are not collectibles. */
const NON_COLLECTIBLE_PATTERNS = [
  /^0x0+2::coin::/,
  /^0x0+3::staking_pool::/,
  /^0x0+2::kiosk::/,
  /^0x0+2::package::/,
  /^0x0+2::transfer_policy::/,
  /::position::/i,
  /Position\b/,
  /::balance_manager::/,
  /Cap\b/,
  /::obligation/i,
  /::receipt/i,
  /::ticket/i,
];

export function isCollectibleType(objectType: string | null): boolean {
  if (!objectType) return false;
  return !NON_COLLECTIBLE_PATTERNS.some((pattern) => pattern.test(objectType));
}

function netDeltas(tx: SuiTransaction, owner: string): Map<string, bigint> {
  const deltas = new Map<string, bigint>();
  for (const change of tx.balanceChanges) {
    if (change.owner !== owner) continue;
    deltas.set(change.coinType, (deltas.get(change.coinType) ?? 0n) + BigInt(change.amount));
  }
  // Gas is paid by the sender in SUI; strip it so a plain swap isn't "SUI out".
  if (tx.sender === owner && deltas.has(SUI_COIN)) {
    deltas.set(SUI_COIN, deltas.get(SUI_COIN)! + BigInt(tx.gasCostMist));
  }
  return deltas;
}

function legsFrom(deltas: Map<string, bigint>, sign: 1n | -1n): Leg[] {
  return [...deltas.entries()]
    .filter(([, amount]) => amount * sign > 0n)
    .map(([coinType, amount]) => ({ coinType, raw: (amount * sign).toString() }));
}

function stakingKind(tx: SuiTransaction): "stake" | "unstake" | null {
  for (const call of tx.moveCalls) {
    if (call.package !== SUI_SYSTEM || call.module !== "sui_system") continue;
    if (call.function.startsWith("request_add_stake")) return "stake";
    if (call.function.startsWith("request_withdraw_stake")) return "unstake";
  }
  return null;
}

function counterpartyFor(tx: SuiTransaction, owner: string, kind: ActivityKind, legs: Leg[]): string | null {
  if (kind === "transfer_in") return tx.sender;
  if (kind !== "transfer_out") return null;
  const coins = new Set(legs.map((leg) => leg.coinType));
  const recipient = tx.balanceChanges.find(
    (change) => change.owner && change.owner !== owner && coins.has(change.coinType) && BigInt(change.amount) > 0n,
  );
  return recipient?.owner ?? null;
}

export function parseActivity(tx: SuiTransaction, ownerInput: string): ParsedActivity {
  const owner = normalizeSuiAddress(ownerInput);
  const deltas = netDeltas(tx, owner);
  const legsOut = legsFrom(deltas, -1n);
  const legsIn = legsFrom(deltas, 1n);
  const isSender = tx.sender === owner;

  const collectibles = tx.objectChanges.filter((change) => isCollectibleType(change.objectType));
  const received = collectibles.filter((c) => c.ownerAfter === owner && c.ownerBefore !== owner);
  const sent = collectibles.filter((c) => c.ownerBefore === owner && c.ownerAfter !== owner && !c.deleted);

  const staking = stakingKind(tx);
  let kind: ActivityKind;
  let nftTypes: string[] = [];
  if (!tx.succeeded) {
    kind = "failed";
  } else if (staking) {
    kind = staking;
  } else if (received.length > 0) {
    nftTypes = received.map((c) => c.objectType!);
    if (received.some((c) => c.created) && isSender) kind = "nft_mint";
    else if (legsOut.length > 0) kind = "nft_buy";
    else kind = "nft_received";
  } else if (sent.length > 0) {
    nftTypes = sent.map((c) => c.objectType!);
    kind = legsIn.length > 0 ? "nft_sell" : "nft_sent";
  } else if (legsOut.length > 0 && legsIn.length > 0) {
    kind = isSender ? "swap" : "other";
  } else if (legsOut.length > 0) {
    const toAnotherWallet = tx.balanceChanges.some(
      (change) =>
        change.owner &&
        change.owner !== owner &&
        BigInt(change.amount) > 0n &&
        legsOut.some((leg) => leg.coinType === change.coinType),
    );
    // Coins landing in another wallet = transfer; coins vanishing into a contract = deposit.
    kind = toAnotherWallet ? "transfer_out" : "deposit";
  } else if (legsIn.length > 0) {
    kind = isSender ? "withdraw" : "transfer_in";
  } else {
    kind = "other";
  }

  const firstCall = tx.moveCalls[0];
  return {
    digest: tx.digest,
    checkpoint: tx.checkpoint,
    timestampMs: tx.timestampMs,
    kind,
    legsOut,
    legsIn,
    gasMist: isSender ? tx.gasCostMist : "0",
    counterparty: counterpartyFor(tx, owner, kind, legsOut),
    nftTypes,
    entrypoint: firstCall ? `${firstCall.module}::${firstCall.function}` : null,
  };
}

export function parseActivities(transactions: SuiTransaction[], owner: string): ParsedActivity[] {
  return transactions.map((tx) => parseActivity(tx, owner));
}
