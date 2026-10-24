import { normalizeStructTag, normalizeSuiAddress } from "@mysten/sui/utils";
import { z } from "zod";
import type { HistoryPage, HistoryPageRequest, HistorySource } from "@/lib/tatum/history";
import type { TatumHttp } from "@/lib/tatum/http";
import type {
  CoinInfo,
  HistoryRange,
  SuiBalanceChange,
  SuiMoveCall,
  SuiObjectChange,
  SuiTransaction,
} from "@/lib/tatum/types";

/**
 * Sui history over Tatum's GraphQL gateway (one operation per POST).
 * Schema verified by introspecting https://sui-mainnet.gateway.tatum.io/graphql.
 */

export class TatumGraphQLError extends Error {
  constructor(readonly messages: string[]) {
    super(`Tatum Sui GraphQL error: ${messages.join("; ")}`);
    this.name = "TatumGraphQLError";
  }
}

/** Nested list cap per transaction; anything beyond flags the transaction as truncated. */
const NESTED_PAGE_SIZE = 50;

const OWNER_FIELDS = `owner { __typename ... on AddressOwner { address { address } } }`;
const OBJECT_STATE = `${OWNER_FIELDS} asMoveObject { contents { type { repr } } }`;

const TRANSACTION_FIELDS = `
  digest
  sender { address }
  effects {
    status
    timestamp
    checkpoint { sequenceNumber }
    gasEffects { gasSummary { computationCost storageCost storageRebate } }
    balanceChanges(first: ${NESTED_PAGE_SIZE}) {
      pageInfo { hasNextPage }
      nodes { owner { address } coinType { repr } amount }
    }
    objectChanges(first: ${NESTED_PAGE_SIZE}) {
      pageInfo { hasNextPage }
      nodes { address idCreated idDeleted inputState { ${OBJECT_STATE} } outputState { ${OBJECT_STATE} } }
    }
  }
  kind {
    __typename
    ... on ProgrammableTransaction {
      commands(first: ${NESTED_PAGE_SIZE}) {
        pageInfo { hasNextPage }
        nodes { __typename ... on MoveCallCommand { function { name module { name package { address } } } } }
      }
    }
  }`;

export const ADDRESS_HISTORY_QUERY = `
query AddressHistory($last: Int, $before: String, $first: Int, $after: String, $filter: TransactionFilter) {
  transactions(last: $last, before: $before, first: $first, after: $after, filter: $filter) {
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    nodes { ${TRANSACTION_FIELDS} }
  }
}`;

export const HISTORY_RANGE_QUERY = `
query HistoryRange($filters: [String!]) {
  serviceConfig {
    availableRange(type: "Query", field: "transactions", filters: $filters) {
      first { sequenceNumber timestamp }
      last { sequenceNumber timestamp }
    }
  }
}`;

export const COIN_METADATA_QUERY = `
query CoinMetadata($coinType: String!) {
  coinMetadata(coinType: $coinType) { symbol name decimals }
}`;

// ---------- response schemas (validate everything that crosses the boundary) ----------

const addressRef = z.object({ address: z.string() }).nullable();
const ownerSchema = z
  .object({ __typename: z.string(), address: addressRef.optional() })
  .nullable()
  .optional();
const objectStateSchema = z
  .object({
    owner: ownerSchema,
    asMoveObject: z
      .object({ contents: z.object({ type: z.object({ repr: z.string() }).nullable() }).nullable() })
      .nullable(),
  })
  .nullable();
const pageFlag = z.object({ hasNextPage: z.boolean() });

const transactionSchema = z.object({
  digest: z.string(),
  sender: addressRef,
  effects: z
    .object({
      status: z.enum(["SUCCESS", "FAILURE"]).nullable(),
      timestamp: z.string().nullable(),
      checkpoint: z.object({ sequenceNumber: z.number() }).nullable(),
      gasEffects: z
        .object({
          gasSummary: z
            .object({
              computationCost: z.union([z.number(), z.string()]).nullable(),
              storageCost: z.union([z.number(), z.string()]).nullable(),
              storageRebate: z.union([z.number(), z.string()]).nullable(),
            })
            .nullable(),
        })
        .nullable(),
      balanceChanges: z
        .object({
          pageInfo: pageFlag,
          nodes: z.array(
            z.object({
              owner: addressRef,
              coinType: z.object({ repr: z.string() }).nullable(),
              amount: z.string().nullable(),
            }),
          ),
        })
        .nullable(),
      objectChanges: z
        .object({
          pageInfo: pageFlag,
          nodes: z.array(
            z.object({
              address: z.string(),
              idCreated: z.boolean().nullable(),
              idDeleted: z.boolean().nullable(),
              inputState: objectStateSchema,
              outputState: objectStateSchema,
            }),
          ),
        })
        .nullable(),
    })
    .nullable(),
  kind: z
    .object({
      __typename: z.string(),
      commands: z
        .object({
          pageInfo: pageFlag,
          nodes: z.array(
            z.object({
              __typename: z.string(),
              function: z
                .object({
                  name: z.string(),
                  module: z.object({
                    name: z.string(),
                    package: z.object({ address: z.string() }).nullable(),
                  }),
                })
                .optional(),
            }),
          ),
        })
        .optional(),
    })
    .nullable(),
});

type RawTransaction = z.infer<typeof transactionSchema>;

const historyResponseSchema = z.object({
  transactions: z.object({
    pageInfo: z.object({
      hasNextPage: z.boolean(),
      hasPreviousPage: z.boolean(),
      startCursor: z.string().nullable(),
      endCursor: z.string().nullable(),
    }),
    nodes: z.array(transactionSchema),
  }),
});

const checkpointRef = z.object({ sequenceNumber: z.number(), timestamp: z.string().nullable() }).nullable();
const rangeResponseSchema = z.object({
  serviceConfig: z.object({ availableRange: z.object({ first: checkpointRef, last: checkpointRef }) }),
});

const coinMetadataResponseSchema = z.object({
  coinMetadata: z
    .object({ symbol: z.string().nullable(), name: z.string().nullable(), decimals: z.number().nullable() })
    .nullable(),
});

const envelopeSchema = z.object({
  data: z.unknown().nullable().optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

// ---------- mapping ----------

function safeStructTag(repr: string): string {
  try {
    return normalizeStructTag(repr);
  } catch {
    return repr;
  }
}

function addressOwner(state: z.infer<typeof objectStateSchema>): string | null {
  const owner = state?.owner;
  if (owner?.__typename !== "AddressOwner" || !owner.address) return null;
  return normalizeSuiAddress(owner.address.address);
}

function sumGas(summary: { computationCost: unknown; storageCost: unknown; storageRebate: unknown } | null): string {
  if (!summary) return "0";
  const toBig = (value: unknown) => BigInt(typeof value === "number" || typeof value === "string" ? value : 0);
  return (toBig(summary.computationCost) + toBig(summary.storageCost) - toBig(summary.storageRebate)).toString();
}

export function mapTransaction(raw: RawTransaction): SuiTransaction {
  const effects = raw.effects;
  const balanceChanges: SuiBalanceChange[] = (effects?.balanceChanges?.nodes ?? [])
    .filter((node) => node.coinType && node.amount !== null)
    .map((node) => ({
      owner: node.owner ? normalizeSuiAddress(node.owner.address) : null,
      coinType: safeStructTag(node.coinType!.repr),
      amount: node.amount!,
    }));

  const objectChanges: SuiObjectChange[] = (effects?.objectChanges?.nodes ?? []).map((node) => {
    const typeRepr =
      node.outputState?.asMoveObject?.contents?.type?.repr ??
      node.inputState?.asMoveObject?.contents?.type?.repr ??
      null;
    return {
      objectId: normalizeSuiAddress(node.address),
      objectType: typeRepr ? safeStructTag(typeRepr) : null,
      created: node.idCreated ?? false,
      deleted: node.idDeleted ?? false,
      ownerBefore: addressOwner(node.inputState),
      ownerAfter: addressOwner(node.outputState),
    };
  });

  const moveCalls: SuiMoveCall[] = (raw.kind?.commands?.nodes ?? []).flatMap((node) =>
    node.__typename === "MoveCallCommand" && node.function?.module.package
      ? [
          {
            package: normalizeSuiAddress(node.function.module.package.address),
            module: node.function.module.name,
            function: node.function.name,
          },
        ]
      : [],
  );

  return {
    digest: raw.digest,
    sender: raw.sender ? normalizeSuiAddress(raw.sender.address) : null,
    checkpoint: effects?.checkpoint?.sequenceNumber ?? 0,
    timestampMs: effects?.timestamp ? Date.parse(effects.timestamp) : 0,
    succeeded: effects?.status === "SUCCESS",
    gasCostMist: sumGas(effects?.gasEffects?.gasSummary ?? null),
    balanceChanges,
    objectChanges,
    moveCalls,
    isTruncated: Boolean(
      effects?.balanceChanges?.pageInfo.hasNextPage ||
        effects?.objectChanges?.pageInfo.hasNextPage ||
        raw.kind?.commands?.pageInfo.hasNextPage,
    ),
  };
}

// ---------- client ----------

export interface SuiGraphQLClientConfig {
  url: string;
  apiKey?: string;
  http: TatumHttp;
}

export interface TatumSuiGraphQL extends HistorySource {
  /** Indexed checkpoint window; `addressFiltered` = the narrower affectedAddress index. */
  historyRange(options: { addressFiltered: boolean }): Promise<HistoryRange | null>;
  coinInfo(coinType: string): Promise<CoinInfo>;
}

export function createTatumSuiGraphQL({ url, apiKey, http }: SuiGraphQLClientConfig): TatumSuiGraphQL {
  async function query<T>(
    operation: string,
    variables: Record<string, unknown>,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const response = await http.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { "x-api-key": apiKey } : {}) },
      body: JSON.stringify({ query: operation, variables }),
    });
    const envelope = envelopeSchema.parse(await response.json());
    if (envelope.errors?.length) throw new TatumGraphQLError(envelope.errors.map((e) => e.message));
    return schema.parse(envelope.data);
  }

  return {
    async historyPage(
      address: string,
      { direction, cursor, pageSize, afterCheckpoint }: HistoryPageRequest,
    ): Promise<HistoryPage> {
      const filter = {
        affectedAddress: normalizeSuiAddress(address),
        ...(afterCheckpoint !== undefined ? { afterCheckpoint } : {}),
      };
      const variables =
        direction === "backward"
          ? { last: pageSize, before: cursor ?? null, filter }
          : { first: pageSize, after: cursor ?? null, filter };
      const data = await query(ADDRESS_HISTORY_QUERY, variables, historyResponseSchema);
      const { pageInfo, nodes } = data.transactions;
      const hasMore = direction === "backward" ? pageInfo.hasPreviousPage : pageInfo.hasNextPage;
      const nextCursor = direction === "backward" ? pageInfo.startCursor : pageInfo.endCursor;
      return {
        transactions: nodes.map(mapTransaction),
        nextCursor: hasMore ? nextCursor : null,
      };
    },

    async historyRange({ addressFiltered }) {
      const filters = addressFiltered ? ["affectedAddress"] : null;
      const data = await query(HISTORY_RANGE_QUERY, { filters }, rangeResponseSchema);
      const { first, last } = data.serviceConfig.availableRange;
      if (!first?.timestamp || !last?.timestamp) return null;
      return {
        firstCheckpoint: first.sequenceNumber,
        firstTimestampMs: Date.parse(first.timestamp),
        lastCheckpoint: last.sequenceNumber,
        lastTimestampMs: Date.parse(last.timestamp),
      };
    },

    async coinInfo(coinType) {
      const normalized = safeStructTag(coinType);
      const data = await query(COIN_METADATA_QUERY, { coinType: normalized }, coinMetadataResponseSchema);
      return {
        coinType: normalized,
        symbol: data.coinMetadata?.symbol ?? null,
        name: data.coinMetadata?.name ?? null,
        decimals: data.coinMetadata?.decimals ?? null,
      };
    },
  };
}
