/**
 * Memory layout for a twin. Walrus Memory has no tag filtering, so each memory type
 * lives in its own namespace: twin:<address>:<type>. That makes the privacy rule
 * structural — public chat can only ever query the PUBLIC_MEMORY_TYPES namespaces.
 */

export const MEMORY_TYPES = ["profile", "trade", "insight", "milestone", "chat"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

/** What a published twin may reveal to other users. Never includes chat or raw trades. */
export const PUBLIC_MEMORY_TYPES: readonly MemoryType[] = ["profile", "insight", "milestone"];
/** What the owner's own twin recalls. */
export const OWNER_MEMORY_TYPES: readonly MemoryType[] = ["profile", "insight", "milestone", "trade", "chat"];

export type Audience = "owner" | "public";

export function memoryTypesFor(audience: Audience): readonly MemoryType[] {
  return audience === "public" ? PUBLIC_MEMORY_TYPES : OWNER_MEMORY_TYPES;
}

export function namespaceFor(address: string, type: MemoryType): string {
  return `twin:${address.toLowerCase()}:${type}`;
}

/** Entries are stored as short text with a type prefix, e.g. "[trade] 2026-10-23 …". */
export function formatMemory(type: MemoryType, text: string): string {
  return `[${type}] ${text.trim()}`;
}

export function memoryTypeOf(text: string): MemoryType | null {
  const match = /^\[(\w+)\]/.exec(text);
  return match && (MEMORY_TYPES as readonly string[]).includes(match[1]) ? (match[1] as MemoryType) : null;
}
