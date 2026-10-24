import { ChannelCredentials } from "@grpc/grpc-js";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { normalizeStructTag, normalizeSuiAddress } from "@mysten/sui/utils";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import type { HistoryPage, HistoryPageRequest, HistorySource } from "@/lib/tatum/history";
import { defaultSleep, type RateGate, type Sleep } from "@/lib/tatum/http";
import type { SuiObjectChange, SuiTransaction } from "@/lib/tatum/types";

/**
 * Address history over Tatum's Sui gRPC gateway (LedgerService/ListTransactions).
 * Tatum speaks native gRPC over HTTP/2, so this uses @grpc/grpc-js rather than the
 * SDK's default gRPC-web transport. Verified 2026-10-24: address-filtered history
 * reaches back to checkpoint 237,661,232 (23 Jan 2026), vs ~90 days on GraphQL.
 */

// Proto enum values (sui.rpc.v2), mirrored to avoid importing generated internals.
const ORDERING_ASCENDING = 0;
const ORDERING_DESCENDING = 1;
const END_ITEM_LIMIT = 1;
const END_SCAN_LIMIT = 2;
const OWNER_KIND_ADDRESS = 1;
const ID_OPERATION_CREATED = 2;
const ID_OPERATION_DELETED = 3;

const READ_MASK = [
  "digest",
  "checkpoint",
  "timestamp",
  "transaction.sender",
  "transaction.kind",
  "effects.status",
  "effects.gas_used",
  "effects.changed_objects",
  "balance_changes",
];

// Minimal structural view of sui.rpc.v2.ExecutedTransaction: only what we map.
interface GrpcOwner {
  kind?: number;
  address?: string;
}

export interface GrpcExecutedTransaction {
  digest?: string;
  checkpoint?: bigint;
  timestamp?: { seconds: bigint; nanos: number };
  transaction?: {
    sender?: string;
    kind?: {
      data:
        | {
            oneofKind: "programmableTransaction";
            programmableTransaction: {
              commands: {
                command:
                  | { oneofKind: "moveCall"; moveCall: { package?: string; module?: string; function?: string } }
                  | { oneofKind: string | undefined };
              }[];
            };
          }
        | { oneofKind: string | undefined };
    };
  };
  effects?: {
    status?: { success?: boolean };
    gasUsed?: { computationCost?: bigint; storageCost?: bigint; storageRebate?: bigint };
    changedObjects: {
      objectId?: string;
      objectType?: string;
      inputOwner?: GrpcOwner;
      outputOwner?: GrpcOwner;
      idOperation?: number;
    }[];
  };
  balanceChanges: { address?: string; coinType?: string; amount?: string }[];
}

function safeStructTag(type: string): string {
  try {
    return normalizeStructTag(type);
  } catch {
    return type;
  }
}

function addressOf(owner: GrpcOwner | undefined): string | null {
  return owner?.kind === OWNER_KIND_ADDRESS && owner.address ? normalizeSuiAddress(owner.address) : null;
}

export function mapGrpcTransaction(raw: GrpcExecutedTransaction): SuiTransaction {
  const gas = raw.effects?.gasUsed;
  const gasCost = (gas?.computationCost ?? 0n) + (gas?.storageCost ?? 0n) - (gas?.storageRebate ?? 0n);

  const objectChanges: SuiObjectChange[] = (raw.effects?.changedObjects ?? [])
    .filter((change) => change.objectId)
    .map((change) => ({
      objectId: normalizeSuiAddress(change.objectId!),
      objectType: change.objectType ? safeStructTag(change.objectType) : null,
      created: change.idOperation === ID_OPERATION_CREATED,
      deleted: change.idOperation === ID_OPERATION_DELETED,
      ownerBefore: addressOf(change.inputOwner),
      ownerAfter: addressOf(change.outputOwner),
    }));

  const kind = raw.transaction?.kind?.data;
  const commands = kind && "programmableTransaction" in kind ? kind.programmableTransaction.commands : [];
  const moveCalls = commands.flatMap(({ command }) =>
    "moveCall" in command && command.moveCall.package && command.moveCall.module && command.moveCall.function
      ? [
          {
            package: normalizeSuiAddress(command.moveCall.package),
            module: command.moveCall.module,
            function: command.moveCall.function,
          },
        ]
      : [],
  );

  return {
    digest: raw.digest ?? "",
    sender: raw.transaction?.sender ? normalizeSuiAddress(raw.transaction.sender) : null,
    checkpoint: Number(raw.checkpoint ?? 0n),
    timestampMs: raw.timestamp
      ? Number(raw.timestamp.seconds) * 1000 + Math.floor(raw.timestamp.nanos / 1_000_000)
      : 0,
    succeeded: raw.effects?.status?.success === true,
    gasCostMist: gasCost.toString(),
    balanceChanges: raw.balanceChanges
      .filter((change) => change.coinType && change.amount)
      .map((change) => ({
        owner: change.address ? normalizeSuiAddress(change.address) : null,
        coinType: safeStructTag(change.coinType!),
        amount: change.amount!,
      })),
    objectChanges,
    moveCalls,
    isTruncated: false,
  };
}

const encodeCursor = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url");
const decodeCursor = (cursor: string): Uint8Array => new Uint8Array(Buffer.from(cursor, "base64url"));

export interface SuiGrpcConfig {
  /** host:port, e.g. sui-mainnet-grpc.gateway.tatum.io:443 */
  host: string;
  apiKey: string;
  /** Share with the HTTP client: Tatum's rate limit covers both transports. */
  gate: RateGate;
  sleep?: Sleep;
  maxRetries?: number;
}

/** Rate limiting surfaces as HTTP 429 / RESOURCE_EXHAUSTED / UNAVAILABLE on gRPC. */
export function isRetryableGrpcError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  return (
    /\b429\b/.test(error.message) ||
    code === "RESOURCE_EXHAUSTED" ||
    code === "UNAVAILABLE" ||
    code === 8 ||
    code === 14
  );
}

export function createTatumSuiGrpc({
  host,
  apiKey,
  gate,
  sleep = defaultSleep,
  maxRetries = 3,
}: SuiGrpcConfig): HistorySource {
  const client = new SuiGrpcClient({
    network: "mainnet",
    transport: new GrpcTransport({
      host,
      channelCredentials: ChannelCredentials.createSsl(),
      meta: { "x-api-key": apiKey },
    }),
  });

  async function withRetry<T>(run: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      await gate.wait();
      try {
        return await run();
      } catch (error: unknown) {
        if (attempt >= maxRetries || !isRetryableGrpcError(error)) throw error;
        await sleep(1500 * 2 ** attempt);
      }
    }
  }

  async function listPage(address: string, request: HistoryPageRequest): Promise<HistoryPage> {
    const backward = request.direction === "backward";
    const cursor = request.cursor ? decodeCursor(request.cursor) : undefined;
    const call = client.ledgerService.listTransactions({
      readMask: { paths: READ_MASK },
      ...(request.afterCheckpoint !== undefined ? { startCheckpoint: BigInt(request.afterCheckpoint + 1) } : {}),
      filter: {
        terms: [
          {
            literals: [
              {
                negated: false,
                predicate: {
                  oneofKind: "affectedAddress",
                  affectedAddress: { address: normalizeSuiAddress(address) },
                },
              },
            ],
          },
        ],
      },
      options: {
        limit: request.pageSize,
        ordering: backward ? ORDERING_DESCENDING : ORDERING_ASCENDING,
        ...(cursor ? (backward ? { before: cursor } : { after: cursor }) : {}),
      },
    });

    const transactions: SuiTransaction[] = [];
    let lastCursor: Uint8Array | undefined;
    let endReason: number | undefined;
    for await (const frame of call.responses) {
      if (frame.transaction) transactions.push(mapGrpcTransaction(frame.transaction));
      if (frame.watermark?.cursor) lastCursor = frame.watermark.cursor;
      if (frame.end) endReason = frame.end.reason;
    }

    // Item/scan limits mean "more may follow"; every other end reason is a hard stop.
    const hasMore = endReason === END_ITEM_LIMIT || endReason === END_SCAN_LIMIT;
    return { transactions, nextCursor: hasMore && lastCursor ? encodeCursor(lastCursor) : null };
  }

  return {
    historyPage: (address, request) => withRetry(() => listPage(address, request)),
  };
}
