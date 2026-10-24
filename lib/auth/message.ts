import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui/utils";

export const NONCE_TTL_MS = 5 * 60 * 1000;

export interface SignInMessageInput {
  address: string;
  nonce: string;
  issuedAt: Date;
  domain: string;
}

/** Human-readable challenge the wallet shows before signing. Signing costs no gas. */
export function buildSignInMessage({ address, nonce, issuedAt, domain }: SignInMessageInput): string {
  return [
    `${domain} wants you to sign in to WalletTwin with your Sui account:`,
    address,
    "",
    "Signing proves you own this wallet. It does not send a transaction, cost gas, or grant any permissions.",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
  ].join("\n");
}

/** Returns the canonical 0x + 64-hex form, or null when the input isn't a Sui address. */
export function parseSuiAddress(input: string): string | null {
  const trimmed = input.trim();
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(trimmed)) return null;
  const normalized = normalizeSuiAddress(trimmed);
  return isValidSuiAddress(normalized) ? normalized : null;
}

export interface NonceRecord {
  address: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export type NonceProblem = "missing" | "address_mismatch" | "expired" | "used";

export function checkNonce(
  record: NonceRecord | null,
  address: string,
  now: Date,
): NonceProblem | null {
  if (!record) return "missing";
  if (record.address !== address) return "address_mismatch";
  if (record.usedAt) return "used";
  if (record.expiresAt.getTime() <= now.getTime()) return "expired";
  return null;
}
