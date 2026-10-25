import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { MAX_BULK_ITEMS, type MemoryBackend, type RecalledMemory } from "@/lib/memory/backend";
import { createLocalBackend } from "@/lib/memory/local";
import {
  type Audience,
  formatMemory,
  type MemoryType,
  memoryTypesFor,
  namespaceFor,
} from "@/lib/memory/namespaces";
import { createWalrusBackend } from "@/lib/memory/walrus";

/**
 * The only entry point the app uses for twin memory. Backed by Walrus Memory when
 * MEMWAL_PRIVATE_KEY + MEMWAL_ACCOUNT_ID are set, otherwise a clearly-labelled local
 * stand-in. Every write goes through the MemoryWrite ledger, so re-syncs never store
 * the same trade twice.
 */

export type { RecalledMemory } from "@/lib/memory/backend";
export { PUBLIC_MEMORY_TYPES, type Audience, type MemoryType } from "@/lib/memory/namespaces";

export interface WalrusConfig {
  key: string;
  accountId: string;
  serverUrl: string;
}

/** MemWal client config when Walrus Memory is configured, else null. */
export function walrusConfig(): WalrusConfig | null {
  const { MEMWAL_PRIVATE_KEY: key, MEMWAL_ACCOUNT_ID: accountId, MEMWAL_SERVER_URL: serverUrl } = env();
  return key && accountId ? { key, accountId, serverUrl } : null;
}

let backend: MemoryBackend | undefined;
function memory(): MemoryBackend {
  if (!backend) {
    const config = walrusConfig();
    backend = config ? createWalrusBackend(config) : createLocalBackend();
    if (!config) console.warn("[memory] MEMWAL_* not set: using the LOCAL memory stand-in, not Walrus.");
  }
  return backend;
}

export function memoryBackendName(): "walrus" | "local" {
  return walrusConfig() ? "walrus" : "local";
}

export interface TwinMemoryEntry {
  type: MemoryType;
  /** Stable identity for idempotency, e.g. "trade:<digest>". */
  key: string;
  text: string;
}

export interface RememberOutcome {
  submitted: number;
  skipped: number;
  failed: number;
}

const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

/** Stores new entries for a twin, skipping keys already stored or in flight. */
export async function rememberTwin(address: string, entries: TwinMemoryEntry[]): Promise<RememberOutcome> {
  const store = memory();
  // Dedupe per backend: switching from the local stand-in to Walrus re-writes everything once.
  const existing = await db.memoryWrite.findMany({
    where: {
      address,
      key: { in: entries.map((entry) => entry.key) },
      status: { not: "failed" },
      backend: store.name,
    },
    select: { key: true },
  });
  const seen = new Set(existing.map((row) => row.key));
  const fresh = entries.filter((entry) => !seen.has(entry.key));
  let failed = 0;

  for (const batch of chunk(fresh, MAX_BULK_ITEMS)) {
    const items = batch.map((entry) => ({
      namespace: namespaceFor(address, entry.type),
      text: formatMemory(entry.type, entry.text),
    }));
    const idempotencyKey = createHash("sha256")
      .update(`${address}|${batch.map((entry) => entry.key).join("|")}`)
      .digest("hex");

    let jobIds: (string | null)[] = [];
    let error: string | null = null;
    try {
      jobIds = await store.rememberBulk(items, idempotencyKey);
    } catch (caught: unknown) {
      error = caught instanceof Error ? caught.message : "memory write failed";
      failed += batch.length;
      console.error("[memory] bulk write failed", error);
    }

    await Promise.all(
      batch.map((entry, index) => {
        const jobId = jobIds[index] ?? null;
        const status = error ? "failed" : jobId ? "pending" : "done";
        const data = { type: entry.type, text: items[index].text, backend: store.name, jobId, status, error };
        return db.memoryWrite.upsert({
          where: { address_key: { address, key: entry.key } },
          create: { address, key: entry.key, ...data },
          update: data,
        });
      }),
    );
  }

  return { submitted: fresh.length - failed, skipped: entries.length - fresh.length, failed };
}

export interface WriteSummary {
  pending: number;
  done: number;
  failed: number;
  backend: "walrus" | "local";
}

/** Polls Walrus for in-flight writes and returns the twin's memory write totals. */
export async function refreshWrites(address: string): Promise<WriteSummary> {
  const backendName = memoryBackendName();
  const pending = await db.memoryWrite.findMany({
    where: { address, backend: backendName, status: "pending", jobId: { not: null } },
  });
  if (pending.length > 0) {
    try {
      const statuses = await memory().jobStatuses(pending.map((row) => row.jobId!));
      await Promise.all(
        pending.flatMap((row) => {
          const next = statuses.get(row.jobId!);
          if (!next || next.status === "pending") return [];
          return [
            db.memoryWrite.update({
              where: { address_key: { address, key: row.key } },
              data: { status: next.status, error: next.error },
            }),
          ];
        }),
      );
    } catch (caught: unknown) {
      console.error("[memory] status poll failed", caught instanceof Error ? caught.message : caught);
    }
  }
  const counts = await db.memoryWrite.groupBy({ by: ["status"], where: { address, backend: backendName }, _count: true });
  const count = (status: string) => counts.find((row) => row.status === status)?._count ?? 0;
  return { pending: count("pending"), done: count("done"), failed: count("failed"), backend: backendName };
}

/**
 * Semantic recall across the namespaces an audience may see. Public recall can never
 * touch [chat] or [trade] memories: those namespaces are simply not queried.
 */
export async function recallTwin(
  address: string,
  query: string,
  options: { audience: Audience; limit?: number; types?: readonly MemoryType[] },
): Promise<RecalledMemory[]> {
  const allowed = memoryTypesFor(options.audience);
  const types = (options.types ?? allowed).filter((type) => allowed.includes(type));
  const limit = options.limit ?? 8;
  const store = memory();
  const perNamespace = await Promise.all(
    types.map((type) =>
      store.recall(namespaceFor(address, type), query, { limit }).catch((caught: unknown) => {
        console.error("[memory] recall failed", type, caught instanceof Error ? caught.message : caught);
        return [] as RecalledMemory[];
      }),
    ),
  );
  return perNamespace
    .flat()
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

/** Newest memories of one type (e.g. the current [profile]). */
export async function latestMemories(
  address: string,
  type: MemoryType,
  options: { query: string; limit?: number },
): Promise<RecalledMemory[]> {
  return memory().recall(namespaceFor(address, type), options.query, {
    limit: options.limit ?? 1,
    sort: "recent",
  });
}
