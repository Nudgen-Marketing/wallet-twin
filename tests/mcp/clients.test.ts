import { describe, expect, test } from "vitest";
import {
  isAcceptableRedirectUri,
  isCimdClientId,
  isPublicAddress,
  isRedirectAllowed,
  parseClientMetadata,
} from "@/lib/mcp/auth/clients";

describe("SSRF guard", () => {
  test.each(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1"])(
    "%s is not public",
    (address) => expect(isPublicAddress(address)).toBe(false),
  );

  test.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("%s is public", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  test("hostnames are never treated as addresses", () => {
    expect(isPublicAddress("example.com")).toBe(false);
  });
});

describe("redirect URIs", () => {
  test("accepts https, loopback http and private-use schemes", () => {
    expect(isAcceptableRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isAcceptableRedirectUri("http://127.0.0.1:33418/callback")).toBe(true);
    expect(isAcceptableRedirectUri("http://localhost:6274/oauth/callback")).toBe(true);
    expect(isAcceptableRedirectUri("cursor://anysphere.cursor-mcp/oauth/callback")).toBe(true);
  });

  test("only reverse-DNS or well-known app schemes", () => {
    expect(isAcceptableRedirectUri("com.example.agent:/oauth/callback")).toBe(true);
    expect(isAcceptableRedirectUri("vscode://ms-vscode.mcp/callback")).toBe(true);
    expect(isAcceptableRedirectUri("ms-msdt:/id PCWDiagnostic")).toBe(false);
    expect(isAcceptableRedirectUri("search-ms:query=x")).toBe(false);
  });

  test("refuses plain http elsewhere, dangerous schemes and fragments", () => {
    expect(isAcceptableRedirectUri("http://evil.example/callback")).toBe(false);
    expect(isAcceptableRedirectUri("javascript:alert(1)")).toBe(false);
    expect(isAcceptableRedirectUri("data:text/html,hi")).toBe(false);
    expect(isAcceptableRedirectUri("https://app.example/cb#frag")).toBe(false);
    expect(isAcceptableRedirectUri("not a url")).toBe(false);
  });

  test("matches exactly, except the port of a loopback redirect", () => {
    const registered = ["https://app.example/cb", "http://127.0.0.1/callback"];
    expect(isRedirectAllowed(registered, "https://app.example/cb")).toBe(true);
    expect(isRedirectAllowed(registered, "https://app.example/cb?x=1")).toBe(false);
    expect(isRedirectAllowed(registered, "https://app.example/other")).toBe(false);
    expect(isRedirectAllowed(registered, "http://127.0.0.1:51234/callback")).toBe(true);
    expect(isRedirectAllowed(registered, "http://127.0.0.1:51234/elsewhere")).toBe(false);
    expect(isRedirectAllowed(registered, "http://localhost:51234/callback")).toBe(false);
  });
});

describe("client ID metadata documents", () => {
  const clientId = "https://agent.example/oauth/client.json";

  test("client ids must be https URLs with a path", () => {
    expect(isCimdClientId(clientId)).toBe(true);
    expect(isCimdClientId("https://agent.example/")).toBe(false);
    expect(isCimdClientId("http://agent.example/client.json")).toBe(false);
    expect(isCimdClientId("https://user:pw@agent.example/client.json")).toBe(false);
    expect(isCimdClientId("wtc_abc")).toBe(false);
  });

  test("IP-literal client ids are refused (they would skip the DNS-time SSRF check)", () => {
    expect(isCimdClientId("https://127.0.0.1/client.json")).toBe(false);
    expect(isCimdClientId("https://[::1]/client.json")).toBe(false);
    expect(isCimdClientId("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isCimdClientId("https://10.0.0.5:6379/x")).toBe(false);
  });

  test("parses a valid document", () => {
    const info = parseClientMetadata(clientId, {
      client_id: clientId,
      client_name: "Agent",
      redirect_uris: ["https://agent.example/cb"],
    });
    expect(info).toMatchObject({ id: clientId, name: "Agent", redirectUris: ["https://agent.example/cb"] });
  });

  test("rejects a document for another client, unsafe redirects or confidential clients", () => {
    expect(() =>
      parseClientMetadata(clientId, { client_id: "https://other.example/c.json", redirect_uris: ["https://agent.example/cb"] }),
    ).toThrow("different client_id");
    expect(() => parseClientMetadata(clientId, { client_id: clientId, redirect_uris: ["http://evil.example/cb"] })).toThrow(
      "unsafe redirect",
    );
    expect(() =>
      parseClientMetadata(clientId, {
        client_id: clientId,
        redirect_uris: ["https://agent.example/cb"],
        token_endpoint_auth_method: "client_secret_basic",
      }),
    ).toThrow("malformed");
  });
});
