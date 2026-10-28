import { describe, expect, test } from "vitest";
import { LIMITS, takeCall } from "@/lib/mcp/limits";
import type { McpPrincipal } from "@/lib/mcp/principal";

const DEMO = `0x${"9".repeat(64)}`;

const grant = (id: string, address: string, demo: boolean): McpPrincipal => ({
  kind: "oauth",
  id: `grant:${id}`,
  address,
  demo,
  scopes: ["twin:chat"],
});

describe("MCP rate limits", () => {
  test("every grant on a demo wallet shares one limit", () => {
    for (let call = 0; call < LIMITS.ask.limit; call += 1) expect(takeCall(grant("a", DEMO, true), "ask")).toBe(true);
    expect(takeCall(grant("b", DEMO, true), "ask")).toBe(false);
  });

  test("grants on a real wallet keep their own limit", () => {
    const owner = `0x${"8".repeat(64)}`;
    for (let call = 0; call < LIMITS.ask.limit; call += 1) expect(takeCall(grant("c", owner, false), "ask")).toBe(true);
    expect(takeCall(grant("c", owner, false), "ask")).toBe(false);
    expect(takeCall(grant("d", owner, false), "ask")).toBe(true);
  });
});
