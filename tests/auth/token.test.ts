import { describe, expect, test } from "vitest";
import { createSessionToken, readSessionToken, SESSION_TTL_SECONDS } from "@/lib/auth/token";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const ADDRESS = `0x${"ab".repeat(32)}`;
const NOW = new Date("2026-10-24T10:00:00Z");

describe("session tokens", () => {
  test("round-trips the wallet address", async () => {
    const token = await createSessionToken({ address: ADDRESS }, SECRET, NOW);
    await expect(readSessionToken(token, SECRET, NOW)).resolves.toEqual({ address: ADDRESS });
  });

  test("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken({ address: ADDRESS }, SECRET, NOW);
    await expect(readSessionToken(token, `${SECRET}-other`, NOW)).resolves.toBeNull();
  });

  test("rejects a token whose payload was tampered with", async () => {
    const token = await createSessionToken({ address: ADDRESS }, SECRET, NOW);
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: `0x${"cd".repeat(32)}`, iss: "wallettwin", aud: "wallettwin:session" }),
    ).toString("base64url");
    await expect(readSessionToken(`${header}.${forgedPayload}.${signature}`, SECRET, NOW)).resolves.toBeNull();
  });

  test("rejects an expired token", async () => {
    const token = await createSessionToken({ address: ADDRESS }, SECRET, NOW);
    const later = new Date(NOW.getTime() + (SESSION_TTL_SECONDS + 1) * 1000);
    await expect(readSessionToken(token, SECRET, later)).resolves.toBeNull();
  });

  test("rejects garbage", async () => {
    await expect(readSessionToken("not.a.jwt", SECRET, NOW)).resolves.toBeNull();
  });
});
