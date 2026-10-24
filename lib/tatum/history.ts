import type { SuiTransaction } from "@/lib/tatum/types";

export const DEFAULT_HISTORY_CAP = 1_000;
export const DEFAULT_HISTORY_PAGE_SIZE = 50;

export interface HistoryPageRequest {
  /** Page backwards from the newest transaction or forwards from `cursor`. */
  direction: "backward" | "forward";
  cursor?: string | null;
  pageSize: number;
  /** Only transactions strictly after this checkpoint (incremental sync). */
  afterCheckpoint?: number;
}

export interface HistoryPage {
  transactions: SuiTransaction[];
  /** Cursor to continue in the same direction; null when there is nothing more. */
  nextCursor: string | null;
}

/** Any Tatum transport that can page an address's history (GraphQL or gRPC). */
export interface HistorySource {
  historyPage(address: string, request: HistoryPageRequest): Promise<HistoryPage>;
}

export interface FetchHistoryOptions {
  /** Stop after this many transactions (newest first). Demo cap keeps credits bounded. */
  maxTransactions?: number;
  pageSize?: number;
  /** Incremental sync: only transactions after the last synced checkpoint. */
  afterCheckpoint?: number;
  onPage?: (progress: { fetched: number; pages: number }) => void;
}

export interface FetchHistoryResult {
  /** Oldest first, de-duplicated by digest. */
  transactions: SuiTransaction[];
  /** True when the cap stopped us before the indexed history ran out. */
  hitCap: boolean;
  pages: number;
}

/**
 * Walks an address's history from newest to oldest until the cap or the start of the
 * index. A page may be empty yet still have a cursor (gRPC scan limits), so only a null
 * cursor ends the walk; `maxPages` guards against a source that never stops.
 */
export async function fetchAddressHistory(
  source: HistorySource,
  address: string,
  options: FetchHistoryOptions = {},
): Promise<FetchHistoryResult> {
  const maxTransactions = options.maxTransactions ?? DEFAULT_HISTORY_CAP;
  const pageSize = options.pageSize ?? DEFAULT_HISTORY_PAGE_SIZE;
  const maxPages = Math.ceil(maxTransactions / pageSize) * 4;
  const byDigest = new Map<string, SuiTransaction>();
  let cursor: string | null = null;
  let pages = 0;

  while (byDigest.size < maxTransactions && pages < maxPages) {
    const page: HistoryPage = await source.historyPage(address, {
      direction: "backward",
      cursor,
      pageSize: Math.min(pageSize, maxTransactions - byDigest.size),
      afterCheckpoint: options.afterCheckpoint,
    });
    pages += 1;
    for (const transaction of page.transactions) byDigest.set(transaction.digest, transaction);
    options.onPage?.({ fetched: byDigest.size, pages });
    if (!page.nextCursor) {
      return { transactions: sortOldestFirst(byDigest), hitCap: false, pages };
    }
    cursor = page.nextCursor;
  }

  return { transactions: sortOldestFirst(byDigest), hitCap: true, pages };
}

function sortOldestFirst(byDigest: Map<string, SuiTransaction>): SuiTransaction[] {
  return [...byDigest.values()].sort(
    (a, b) => a.checkpoint - b.checkpoint || a.timestampMs - b.timestampMs,
  );
}
