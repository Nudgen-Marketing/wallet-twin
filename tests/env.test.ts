import { describe, expect, test } from "vitest";
import { parseEnv } from "@/lib/env";

const BASE = {
  DATABASE_URL: "postgresql://localhost:5432/wallet_twin",
  SESSION_SECRET: "x".repeat(32),
};

describe("parseEnv", () => {
  test("boots with only the app essentials and applies defaults", () => {
    const env = parseEnv(BASE);

    expect(env.NEXT_PUBLIC_SUI_NETWORK).toBe("mainnet");
    expect(env.MEMWAL_SERVER_URL).toBe("https://relayer.memory.walrus.xyz");
    expect(env.ANTHROPIC_MODEL).toBe("claude-sonnet-5-5");
    expect(env.TATUM_API_KEY).toBeUndefined();
  });

  test("treats empty feature secrets as unset", () => {
    expect(parseEnv({ ...BASE, TATUM_API_KEY: "" }).TATUM_API_KEY).toBeUndefined();
  });

  test("fails fast on a short session secret and names the variable, not the value", () => {
    const secret = "short-secret-value";
    const run = () => parseEnv({ ...BASE, SESSION_SECRET: secret });

    expect(run).toThrow(/SESSION_SECRET/);
    expect(run).not.toThrow(new RegExp(secret));
  });

  test("rejects an unknown network", () => {
    expect(() => parseEnv({ ...BASE, NEXT_PUBLIC_SUI_NETWORK: "devnet" })).toThrow(/NEXT_PUBLIC_SUI_NETWORK/);
  });
});
