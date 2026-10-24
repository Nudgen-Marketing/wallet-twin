import { describe, expect, test } from "vitest";
import { buildSignInMessage, checkNonce, parseSuiAddress } from "@/lib/auth/message";

const ADDRESS = `0x${"ab".repeat(32)}`;

describe("buildSignInMessage", () => {
  test("includes domain, address, nonce and issue time so the signature is bound to them", () => {
    const message = buildSignInMessage({
      address: ADDRESS,
      nonce: "f".repeat(32),
      issuedAt: new Date("2026-10-24T10:00:00.000Z"),
      domain: "localhost:3000",
    });

    expect(message).toContain("localhost:3000 wants you to sign in to WalletTwin");
    expect(message).toContain(ADDRESS);
    expect(message).toContain(`Nonce: ${"f".repeat(32)}`);
    expect(message).toContain("Issued At: 2026-10-24T10:00:00.000Z");
    expect(message).toMatch(/does not send a transaction/);
  });
});

describe("parseSuiAddress", () => {
  test("normalizes short addresses to 0x + 64 hex", () => {
    expect(parseSuiAddress("0x2")).toBe(`0x${"0".repeat(63)}2`);
  });

  test("lower-cases and trims", () => {
    expect(parseSuiAddress(`  0x${"AB".repeat(32)} `)).toBe(ADDRESS);
  });

  test("rejects non-addresses", () => {
    expect(parseSuiAddress("not-an-address")).toBeNull();
    expect(parseSuiAddress(`0x${"g".repeat(64)}`)).toBeNull();
  });
});

describe("checkNonce", () => {
  const now = new Date("2026-10-24T10:00:00Z");
  const fresh = { address: ADDRESS, expiresAt: new Date("2026-10-24T10:05:00Z"), usedAt: null };

  test("accepts an unused, unexpired nonce for the same address", () => {
    expect(checkNonce(fresh, ADDRESS, now)).toBeNull();
  });

  test("rejects a missing nonce", () => {
    expect(checkNonce(null, ADDRESS, now)).toBe("missing");
  });

  test("rejects a nonce issued to another address", () => {
    expect(checkNonce(fresh, `0x${"cd".repeat(32)}`, now)).toBe("address_mismatch");
  });

  test("rejects a used nonce", () => {
    expect(checkNonce({ ...fresh, usedAt: now }, ADDRESS, now)).toBe("used");
  });

  test("rejects a nonce at or past its expiry", () => {
    expect(checkNonce(fresh, ADDRESS, new Date("2026-10-24T10:05:00Z"))).toBe("expired");
  });
});
