import "server-only";
import { MemWal } from "@mysten-incubation/memwal";
import type { MemoryBackend, WriteStatus } from "@/lib/memory/backend";

/**
 * Walrus Memory (MemWal) backend. Writes are async on the relayer
 * (embed → Seal-encrypt → Walrus blob → Sui tx, 20–90 s), so we submit bulk jobs and
 * poll their status rather than blocking a request on them.
 * SDK: @mysten-incubation/memwal (https://github.com/MystenLabs/MemWal)
 */

function toStatus(status: string): WriteStatus {
  if (status === "done") return "done";
  if (status === "failed" || status === "not_found") return "failed";
  return "pending";
}

export function createWalrusBackend(config: { key: string; accountId: string; serverUrl: string }): MemoryBackend {
  const client = MemWal.create(config);

  return {
    name: "walrus",

    async rememberBulk(items, idempotencyKey) {
      const accepted = await client.rememberBulkAsync(items, { idempotencyKey });
      return items.map((_, index) => accepted.job_ids[index] ?? null);
    },

    async jobStatuses(jobIds) {
      const statuses = new Map<string, { status: WriteStatus; error: string | null }>();
      if (jobIds.length === 0) return statuses;
      const result = await client.getRememberBulkStatus(jobIds);
      for (const item of result.results) {
        statuses.set(item.job_id, { status: toStatus(item.status), error: item.error ?? null });
      }
      return statuses;
    },

    async recall(namespace, query, { limit, sort }) {
      const result = await client.recall({ query, namespace, limit, ...(sort ? { sort } : {}) });
      return result.results.map((memory) => ({
        text: memory.text,
        distance: memory.distance,
        createdAt: memory.created_at ?? null,
        namespace,
      }));
    },
  };
}
