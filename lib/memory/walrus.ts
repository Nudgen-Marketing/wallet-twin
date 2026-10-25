import "server-only";
import { MemWal } from "@mysten-incubation/memwal";
import type { MemoryBackend, WriteStatus } from "@/lib/memory/backend";
import { createWeightedBudget, RELAYER_WEIGHT, withRelayerRetry } from "@/lib/memory/budget";

/**
 * Walrus Memory (MemWal) backend. Writes are async on the relayer
 * (embed → Seal-encrypt → Walrus blob → Sui tx, 20–90 s), so we submit bulk jobs and
 * poll their status rather than blocking a request on them.
 * SDK: @mysten-incubation/memwal (https://github.com/MystenLabs/MemWal)
 */

/** The relayer rejects bulk status requests with more than 20 job ids. */
const MAX_STATUS_IDS = 20;

function toStatus(status: string): WriteStatus {
  if (status === "done") return "done";
  if (status === "failed" || status === "not_found") return "failed";
  return "pending";
}

export function createWalrusBackend(config: { key: string; accountId: string; serverUrl: string }): MemoryBackend {
  const client = MemWal.create(config);
  // 60 weighted requests/min per delegate key; keep a little headroom.
  const budget = createWeightedBudget({ limit: 55, windowMs: 60_000 });
  const paced = async <T>(weight: number, call: () => Promise<T>) =>
    withRelayerRetry(async () => {
      await budget.take(weight);
      return call();
    });

  return {
    name: "walrus",

    async rememberBulk(items, idempotencyKey) {
      const accepted = await paced(RELAYER_WEIGHT.bulk, () => client.rememberBulkAsync(items, { idempotencyKey }));
      return items.map((_, index) => accepted.job_ids[index] ?? null);
    },

    async jobStatuses(jobIds) {
      const statuses = new Map<string, { status: WriteStatus; error: string | null }>();
      for (let start = 0; start < jobIds.length; start += MAX_STATUS_IDS) {
        const chunk = jobIds.slice(start, start + MAX_STATUS_IDS);
        const result = await paced(RELAYER_WEIGHT.status, () => client.getRememberBulkStatus(chunk));
        for (const item of result.results) {
          statuses.set(item.job_id, { status: toStatus(item.status), error: item.error ?? null });
        }
      }
      return statuses;
    },

    async recall(namespace, query, { limit, sort }) {
      const result = await paced(RELAYER_WEIGHT.recall, () =>
        client.recall({ query, namespace, limit, ...(sort ? { sort } : {}) }),
      );
      return result.results.map((memory) => ({
        text: memory.text,
        distance: memory.distance,
        createdAt: memory.created_at ?? null,
        namespace,
      }));
    },
  };
}
