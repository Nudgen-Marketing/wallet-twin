import "server-only";
import { randomBytes } from "node:crypto";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * OAuth clients. A 2026-era client identifies itself with a Client ID Metadata Document (CIMD):
 * its client_id is an HTTPS URL serving its metadata. Older clients register through Dynamic
 * Client Registration (RFC 7591) first. Both are public clients: PKCE, no client secret.
 */

export interface OAuthClientInfo {
  id: string;
  name: string;
  redirectUris: string[];
  logoUri: string | null;
  clientUri: string | null;
  source: "dcr" | "cimd";
}

export class ClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientError";
  }
}

const CIMD_TTL_MS = 24 * 60 * 60 * 1000;
const CIMD_TIMEOUT_MS = 3_000;
const CIMD_MAX_BYTES = 8 * 1024;
const MAX_REDIRECT_URIS = 10;
const UNREACHABLE = "Couldn't load the client's metadata document.";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);
/**
 * Native apps' own schemes: reverse-DNS private-use schemes (RFC 8252 §7.1) or a few well-known
 * MCP clients. Anything else (ms-msdt:, search-ms:, javascript:…) could launch a local handler.
 */
const KNOWN_APP_SCHEMES = new Set(["cursor:", "vscode:", "vscode-insiders:", "windsurf:", "claude:", "zed:"]);
const REVERSE_DNS_SCHEME = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+:$/;

/** Addresses a server-side fetch must never reach (SSRF): private, loopback, link-local, CGNAT, multicast. */
const BLOCKED = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  BLOCKED.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["2001::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  BLOCKED.addSubnet(network, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) is judged by the IPv4 address inside it.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  const candidate = mapped ?? address;
  const family = isIP(candidate);
  if (family === 0) return false;
  return !BLOCKED.check(candidate, family === 4 ? "ipv4" : "ipv6");
}

/** A redirect URI a client may register: https, loopback http, or a native app's private-use scheme. */
export function isAcceptableRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") return LOOPBACK_HOSTS.has(url.hostname);
  return KNOWN_APP_SCHEMES.has(url.protocol) || REVERSE_DNS_SCHEME.test(url.protocol);
}

/**
 * Exact match, except that native apps on loopback may pick any port at runtime (RFC 8252 §7.3).
 */
export function isRedirectAllowed(registered: readonly string[], requested: string): boolean {
  if (registered.includes(requested)) return true;
  let asked: URL;
  try {
    asked = new URL(requested);
  } catch {
    return false;
  }
  if (asked.protocol !== "http:" || !LOOPBACK_HOSTS.has(asked.hostname)) return false;
  return registered.some((uri) => {
    const candidate = new URL(uri);
    return (
      candidate.protocol === "http:" &&
      candidate.hostname === asked.hostname &&
      candidate.pathname === asked.pathname &&
      candidate.search === asked.search
    );
  });
}

/** A CIMD client_id: https, with a path, no fragment or credentials (draft-ietf-oauth-client-id-metadata-document). */
export function isCimdClientId(clientId: string): boolean {
  try {
    const url = new URL(clientId);
    // An IP literal skips DNS, so the lookup-time SSRF guard would never see it: names only.
    const isIpLiteral = isIP(url.hostname.replace(/^\[|\]$/g, "")) !== 0;
    return (
      url.protocol === "https:" &&
      !isIpLiteral &&
      url.pathname !== "/" &&
      !url.hash &&
      !url.username &&
      !url.password &&
      !url.pathname.split("/").some((segment) => segment === "." || segment === "..")
    );
  } catch {
    return false;
  }
}

const metadataSchema = z.object({
  client_id: z.string(),
  client_name: z.string().trim().min(1).max(100).optional(),
  redirect_uris: z.array(z.string().max(2000)).min(1).max(MAX_REDIRECT_URIS),
  logo_uri: z.url().optional(),
  client_uri: z.url().optional(),
  token_endpoint_auth_method: z.literal("none").optional(),
});

/** Resolves the host itself and refuses private addresses, so DNS can't point the fetch inside our network. */
function safeLookup(
  hostname: string,
  options: { all?: boolean },
  callback: (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
): void {
  dnsLookup(hostname, { all: true }, (error, addresses) => {
    if (error) return callback(error, []);
    const unsafe = addresses.find((entry) => !isPublicAddress(entry.address));
    if (unsafe || addresses.length === 0) {
      return callback(Object.assign(new Error("Client metadata host resolves to a private address"), { code: "EBLOCKED" }), []);
    }
    if (options.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
}

/** GETs a client metadata document: HTTPS only, public addresses only, no redirects, small and fast. */
export function fetchClientMetadata(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      url,
      { method: "GET", headers: { accept: "application/json" }, lookup: safeLookup, timeout: CIMD_TIMEOUT_MS },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          return reject(new ClientError(UNREACHABLE));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > CIMD_MAX_BYTES) {
            request.destroy();
            reject(new ClientError("Client metadata document is too large."));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new ClientError("Client metadata isn't valid JSON."));
          }
        });
      },
    );
    // One message for timeouts, refusals and TLS errors, so this can't be used to probe ports.
    request.on("timeout", () => request.destroy());
    request.on("error", (error) => reject(error instanceof ClientError ? error : new ClientError(UNREACHABLE)));
    request.end();
  });
}

function toInfo(row: {
  id: string;
  name: string;
  redirectUris: string;
  logoUri: string | null;
  clientUri: string | null;
  source: string;
}): OAuthClientInfo {
  return {
    id: row.id,
    name: row.name,
    redirectUris: JSON.parse(row.redirectUris) as string[],
    logoUri: row.logoUri,
    clientUri: row.clientUri,
    source: row.source === "cimd" ? "cimd" : "dcr",
  };
}

/** Validates a fetched CIMD document against its own URL. Exported for tests. */
export function parseClientMetadata(clientId: string, raw: unknown): Omit<OAuthClientInfo, "source"> {
  const parsed = metadataSchema.safeParse(raw);
  if (!parsed.success) throw new ClientError("The client's metadata document is malformed.");
  const doc = parsed.data;
  if (doc.client_id !== clientId) throw new ClientError("The client's metadata names a different client_id.");
  if (!doc.redirect_uris.every(isAcceptableRedirectUri)) throw new ClientError("The client registered an unsafe redirect URI.");
  return {
    id: clientId,
    name: doc.client_name ?? new URL(clientId).hostname,
    redirectUris: doc.redirect_uris,
    logoUri: doc.logo_uri ?? null,
    clientUri: doc.client_uri ?? null,
  };
}

async function loadCimdClient(clientId: string, now: Date, fetcher: (url: string) => Promise<unknown>): Promise<OAuthClientInfo> {
  const cached = await db.oAuthClient.findUnique({ where: { id: clientId } });
  if (cached && cached.source === "cimd" && now.getTime() - cached.fetchedAt.getTime() < CIMD_TTL_MS) return toInfo(cached);
  const info = parseClientMetadata(clientId, await fetcher(clientId));
  const data = {
    name: info.name,
    redirectUris: JSON.stringify(info.redirectUris),
    logoUri: info.logoUri,
    clientUri: info.clientUri,
    source: "cimd",
    fetchedAt: now,
  };
  const row = await db.oAuthClient.upsert({ where: { id: clientId }, create: { id: clientId, ...data }, update: data });
  return toInfo(row);
}

/** Finds a client by id: fetches (and caches) a CIMD document, or looks up a DCR registration. */
export async function resolveClient(
  clientId: string,
  options: { now?: Date; fetcher?: (url: string) => Promise<unknown> } = {},
): Promise<OAuthClientInfo> {
  if (isCimdClientId(clientId)) return loadCimdClient(clientId, options.now ?? new Date(), options.fetcher ?? fetchClientMetadata);
  const row = await db.oAuthClient.findUnique({ where: { id: clientId } });
  if (!row || row.source !== "dcr") throw new ClientError("Unknown client. Ask your app to register again.");
  return toInfo(row);
}

export const registrationSchema = z.object({
  redirect_uris: z.array(z.string().max(2000)).min(1).max(MAX_REDIRECT_URIS),
  client_name: z.string().trim().min(1).max(100).optional(),
  client_uri: z.url().optional(),
  logo_uri: z.url().optional(),
  token_endpoint_auth_method: z.literal("none").optional(),
  grant_types: z.array(z.enum(["authorization_code", "refresh_token"])).optional(),
  response_types: z.array(z.literal("code")).optional(),
});

/** Dynamic Client Registration (RFC 7591), public clients only. Deprecated by CIMD but still widely used. */
export async function registerClient(input: z.infer<typeof registrationSchema>): Promise<OAuthClientInfo> {
  if (!input.redirect_uris.every(isAcceptableRedirectUri)) throw new ClientError("One of the redirect URIs isn't allowed.");
  const row = await db.oAuthClient.create({
    data: {
      id: `wtc_${randomBytes(16).toString("base64url")}`,
      name: input.client_name ?? "Unnamed agent",
      redirectUris: JSON.stringify(input.redirect_uris),
      logoUri: input.logo_uri ?? null,
      clientUri: input.client_uri ?? null,
      source: "dcr",
    },
  });
  return toInfo(row);
}
