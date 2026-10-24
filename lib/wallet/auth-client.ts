import type { ApiResponse } from "@/lib/http/api";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !body?.success || body.data === null) {
    throw new Error(body?.error ?? "Something went wrong. Please try again.");
  }
  return body.data;
}

export function fetchSession(): Promise<{ address: string | null }> {
  return call("/api/auth/session", { cache: "no-store" });
}

export function requestNonce(address: string): Promise<{ nonce: string; message: string }> {
  return call("/api/auth/nonce", { method: "POST", body: JSON.stringify({ address }) });
}

export function verifySignIn(input: {
  address: string;
  nonce: string;
  signature: string;
}): Promise<{ address: string }> {
  return call("/api/auth/verify", { method: "POST", body: JSON.stringify(input) });
}

export function signOut(): Promise<{ address: null }> {
  return call("/api/auth/logout", { method: "POST" });
}
