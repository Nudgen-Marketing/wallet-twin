import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/copy/service", () => ({ backtestCopyReturnPct: async () => null }));
import { db } from "@/lib/db";
import { setPublished, TwinActionError } from "@/lib/twin/actions";
import { isPublished } from "@/lib/twin/publish";

const ADDRESS = `0x${"7".repeat(64)}`;

describe("setPublished", () => {
  test("refuses to publish a twin that was never synced", async () => {
    await expect(setPublished({ address: ADDRESS }, true)).rejects.toMatchObject({ status: 409 });
    expect(await isPublished(ADDRESS)).toBe(false);
  });

  test("publishes a synced twin and unpublishes it again", async () => {
    await db.syncState.create({ data: { address: ADDRESS, lastSyncedAt: new Date() } });
    await setPublished({ address: ADDRESS }, true);
    expect(await isPublished(ADDRESS)).toBe(true);
    await setPublished({ address: ADDRESS }, false);
    expect(await isPublished(ADDRESS)).toBe(false);
  });

  test("demo sessions can't unpublish", async () => {
    await setPublished({ address: ADDRESS }, true);
    const attempt = setPublished({ address: ADDRESS, demo: true }, false);
    await expect(attempt).rejects.toBeInstanceOf(TwinActionError);
    await expect(attempt).rejects.toMatchObject({ status: 403 });
    expect(await isPublished(ADDRESS)).toBe(true);
  });
});
