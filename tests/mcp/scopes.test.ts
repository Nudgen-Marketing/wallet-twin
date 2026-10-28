import { describe, expect, test } from "vitest";
import { DEFAULT_SCOPES, formatScopes, parseScopes } from "@/lib/mcp/scopes";
import { hasScope } from "@/lib/mcp/principal";

describe("scopes", () => {
  test("keeps known scopes, drops unknown ones, dedupes and orders them", () => {
    expect(parseScopes("copy:trade twin:read admin twin:read")).toEqual(["twin:read", "copy:trade"]);
    expect(parseScopes(["twin:chat"])).toEqual(["twin:chat"]);
    expect(parseScopes(undefined)).toEqual([]);
    expect(formatScopes(["twin:read", "twin:sync"])).toBe("twin:read twin:sync");
  });

  test("publishing is never granted by default", () => {
    expect(DEFAULT_SCOPES).not.toContain("twin:publish");
    expect(DEFAULT_SCOPES).toContain("twin:read");
  });

  test("anonymous callers hold no scope", () => {
    expect(hasScope({ kind: "anonymous", id: "ip:1", address: null, demo: false, scopes: ["twin:read"] }, "twin:read")).toBe(false);
  });
});
