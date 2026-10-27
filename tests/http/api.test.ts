import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { isSameOrigin } from "@/lib/http/api";

// The standalone server sees its bind address (HOSTNAME=0.0.0.0) as the request URL's host.
const post = (headers: Record<string, string>) =>
  new NextRequest("http://0.0.0.0:3000/api/sync", { method: "POST", headers });

describe("isSameOrigin", () => {
  test("accepts the public origin behind a proxy that forwards the Host header", () => {
    expect(isSameOrigin(post({ host: "wallet-twin.gcp.nudgen.net", origin: "https://wallet-twin.gcp.nudgen.net" }))).toBe(true);
  });

  test("prefers X-Forwarded-Host over the Host header", () => {
    const request = post({
      host: "srv-captain--wallet-twin:3000",
      "x-forwarded-host": "wallet-twin.gcp.nudgen.net",
      origin: "https://wallet-twin.gcp.nudgen.net",
    });
    expect(isSameOrigin(request)).toBe(true);
  });

  test("accepts a local dev request", () => {
    expect(isSameOrigin(post({ host: "localhost:3100", origin: "http://localhost:3100" }))).toBe(true);
  });

  test("rejects cross-site, missing and malformed origins", () => {
    expect(isSameOrigin(post({ host: "wallet-twin.gcp.nudgen.net", origin: "https://evil.example" }))).toBe(false);
    expect(isSameOrigin(post({ host: "wallet-twin.gcp.nudgen.net" }))).toBe(false);
    expect(isSameOrigin(post({ host: "wallet-twin.gcp.nudgen.net", origin: "not a url" }))).toBe(false);
  });
});
