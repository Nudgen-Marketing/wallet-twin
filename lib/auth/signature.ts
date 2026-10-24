import type { ClientWithCoreApi } from "@mysten/sui/client";
import { isValidPersonalMessageSignature } from "@mysten/sui/verify";

export class SignatureCheckUnavailableError extends Error {
  constructor(cause: unknown) {
    super("Signature verification is temporarily unavailable", { cause });
    this.name = "SignatureCheckUnavailableError";
  }
}

/**
 * True when `signature` is `address` signing `message` as a Sui personal message.
 * `client` is needed for zkLogin wallets (on-chain JWK/epoch lookups).
 * Network failures throw SignatureCheckUnavailableError so they are never mistaken
 * for a bad signature.
 */
export async function verifySignInSignature(
  message: string,
  signature: string,
  address: string,
  client?: ClientWithCoreApi,
): Promise<boolean> {
  try {
    return await isValidPersonalMessageSignature(new TextEncoder().encode(message), signature, {
      address,
      client,
    });
  } catch (error: unknown) {
    throw new SignatureCheckUnavailableError(error);
  }
}
