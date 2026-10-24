/** Storage contract shared by Walrus Memory and the local stand-in. */

export interface MemoryItem {
  namespace: string;
  text: string;
}

export interface RecalledMemory {
  text: string;
  /** 0 = identical; larger = less related. */
  distance: number;
  createdAt: string | null;
  namespace: string;
}

export type WriteStatus = "pending" | "done" | "failed";

export interface MemoryBackend {
  readonly name: "walrus" | "local";
  /** Accepts up to 20 items; returns one job id per item (null when stored synchronously). */
  rememberBulk(items: MemoryItem[], idempotencyKey: string): Promise<(string | null)[]>;
  jobStatuses(jobIds: string[]): Promise<Map<string, { status: WriteStatus; error: string | null }>>;
  recall(
    namespace: string,
    query: string,
    options: { limit: number; sort?: "relevance" | "recent" },
  ): Promise<RecalledMemory[]>;
}

export const MAX_BULK_ITEMS = 20;
