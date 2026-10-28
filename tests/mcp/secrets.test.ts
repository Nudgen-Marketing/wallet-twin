import { describe, expect, test } from "vitest";
import { hashSecret, newSecret, pkceChallenge, secretKind, verifyPkce } from "@/lib/mcp/auth/secrets";

describe("secrets", () => {
  test("new secrets carry their kind's prefix and are unique", () => {
    const a = newSecret("apiKey");
    const b = newSecret("apiKey");
    expect(a).toMatch(/^wt_key_[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    expect(secretKind(a)).toBe("apiKey");
    expect(secretKind(newSecret("access"))).toBe("access");
    expect(secretKind("ghp_something")).toBeNull();
  });

  test("hashes are stable and never equal the secret", () => {
    const secret = newSecret("refresh");
    expect(hashSecret(secret)).toBe(hashSecret(secret));
    expect(hashSecret(secret)).not.toContain(secret);
    expect(hashSecret(secret)).toHaveLength(64);
  });
});

describe("PKCE S256", () => {
  // RFC 7636 appendix B test vector.
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

  test("matches the RFC 7636 test vector", () => {
    expect(pkceChallenge(verifier)).toBe(challenge);
    expect(verifyPkce(verifier, challenge)).toBe(true);
  });

  test("rejects a wrong verifier, a short verifier and a plain challenge", () => {
    expect(verifyPkce(`${verifier.slice(0, -1)}x`, challenge)).toBe(false);
    expect(verifyPkce("short", pkceChallenge("short"))).toBe(false);
    expect(verifyPkce(verifier, verifier)).toBe(false);
  });
});
