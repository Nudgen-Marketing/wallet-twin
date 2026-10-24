import { apiCall } from "@/lib/http/client";

export function fetchSession(): Promise<{ address: string | null; demo: boolean }> {
  return apiCall("/api/auth/session", { cache: "no-store" });
}

export function requestNonce(address: string): Promise<{ nonce: string; message: string }> {
  return apiCall("/api/auth/nonce", { method: "POST", body: JSON.stringify({ address }) });
}

export function verifySignIn(input: {
  address: string;
  nonce: string;
  signature: string;
}): Promise<{ address: string }> {
  return apiCall("/api/auth/verify", { method: "POST", body: JSON.stringify(input) });
}

export function signOut(): Promise<{ address: null }> {
  return apiCall("/api/auth/logout", { method: "POST" });
}
