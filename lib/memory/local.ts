import "server-only";
import { db } from "@/lib/db";
import type { MemoryBackend } from "@/lib/memory/backend";

/**
 * Local stand-in used ONLY while MEMWAL_PRIVATE_KEY / MEMWAL_ACCOUNT_ID are unset, so the
 * app stays usable in development. The UI labels it clearly; production uses Walrus.
 * Recall is keyword overlap, not semantic search.
 */

const tokenize = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9$%.]+/)
      .filter((word) => word.length >= 3),
  );

export function keywordDistance(query: string, text: string): number {
  const queryWords = tokenize(query);
  if (queryWords.size === 0) return 1;
  const textWords = tokenize(text);
  const hits = [...queryWords].filter((word) => textWords.has(word)).length;
  return 1 - hits / queryWords.size;
}

export function createLocalBackend(): MemoryBackend {
  return {
    name: "local",

    async rememberBulk(items) {
      await db.localMemory.createMany({ data: items.map(({ namespace, text }) => ({ namespace, text })) });
      return items.map(() => null);
    },

    async jobStatuses() {
      return new Map();
    },

    async recall(namespace, query, { limit, sort }) {
      const rows = await db.localMemory.findMany({
        where: { namespace },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      const scored = rows.map((row) => ({
        text: row.text,
        distance: keywordDistance(query, row.text),
        createdAt: row.createdAt.toISOString(),
        namespace,
      }));
      const ordered = sort === "recent" ? scored : [...scored].sort((a, b) => a.distance - b.distance);
      return ordered.slice(0, limit);
    },
  };
}
