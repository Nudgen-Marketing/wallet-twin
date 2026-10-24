import { describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import { memoryBackendName, recallTwin, refreshWrites, rememberTwin, type TwinMemoryEntry } from "@/lib/memory";

let counter = 0;
const freshAddress = () => `0x${(++counter).toString(16).padStart(64, "0")}`;

const ENTRIES: TwinMemoryEntry[] = [
  { type: "profile", key: "profile:r1", text: "Fast memecoin trader who loves MAGMA." },
  { type: "insight", key: "insight:r1:0", text: "Sells MAGMA within 8 hours most of the time." },
  { type: "milestone", key: "milestone:biggest-win:D1", text: "Biggest win: +$151 on MAGMA." },
  { type: "trade", key: "trade:D2", text: "Swapped 500 MAGMA for 168 USDC." },
  { type: "chat", key: "chat:h1", text: "I am saving for a house; MAGMA is my house fund." },
];

describe("rememberTwin (local backend in tests)", () => {
  test("uses the local stand-in when MemWal credentials are absent", () => {
    expect(memoryBackendName()).toBe("local");
  });

  test("re-sync never stores the same key twice", async () => {
    const address = freshAddress();

    const first = await rememberTwin(address, ENTRIES);
    const second = await rememberTwin(address, ENTRIES);

    expect(first).toEqual({ submitted: 5, skipped: 0, failed: 0 });
    expect(second).toEqual({ submitted: 0, skipped: 5, failed: 0 });
    expect(await db.memoryWrite.count({ where: { address } })).toBe(5);
    expect(await refreshWrites(address)).toMatchObject({ done: 5, pending: 0, failed: 0 });
  });

  test("stores entries with their [type] prefix in per-type namespaces", async () => {
    const address = freshAddress();
    await rememberTwin(address, ENTRIES);

    const stored = await db.localMemory.findMany({ where: { namespace: { startsWith: `twin:${address}:` } } });

    expect(stored.map((row) => row.namespace).sort()).toEqual(
      ["chat", "insight", "milestone", "profile", "trade"].map((type) => `twin:${address}:${type}`),
    );
    expect(stored.find((row) => row.namespace.endsWith(":trade"))?.text).toBe("[trade] Swapped 500 MAGMA for 168 USDC.");
  });
});

describe("recallTwin privacy", () => {
  test("the owner can recall chat facts and trades", async () => {
    const address = freshAddress();
    await rememberTwin(address, ENTRIES);

    const memories = await recallTwin(address, "MAGMA house fund trade", { audience: "owner", limit: 10 });
    const types = new Set(memories.map((memory) => memory.text.match(/^\[(\w+)\]/)?.[1]));

    expect(types).toEqual(new Set(["profile", "insight", "milestone", "trade", "chat"]));
  });

  test("public recall never returns [chat] or [trade], even when they match best", async () => {
    const address = freshAddress();
    await rememberTwin(address, ENTRIES);

    const memories = await recallTwin(address, "saving for a house fund", { audience: "public", limit: 10 });

    expect(memories.length).toBeGreaterThan(0);
    for (const memory of memories) {
      expect(memory.text).not.toMatch(/^\[(chat|trade)\]/);
      expect(memory.namespace).not.toMatch(/:(chat|trade)$/);
    }
  });

  test("asking for private types with a public audience is silently narrowed", async () => {
    const address = freshAddress();
    await rememberTwin(address, ENTRIES);

    const memories = await recallTwin(address, "house", { audience: "public", types: ["chat", "trade"] });

    expect(memories).toEqual([]);
  });
});
