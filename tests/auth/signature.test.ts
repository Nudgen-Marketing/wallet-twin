import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { describe, expect, test } from "vitest";
import { verifySignInSignature } from "@/lib/auth/signature";

const MESSAGE = "localhost:3000 wants you to sign in to WalletTwin\nNonce: abc";

async function sign(keypair: Ed25519Keypair, message: string): Promise<string> {
  const { signature } = await keypair.signPersonalMessage(new TextEncoder().encode(message));
  return signature;
}

describe("verifySignInSignature", () => {
  test("accepts the wallet's own signature over the exact message", async () => {
    const keypair = Ed25519Keypair.generate();
    const signature = await sign(keypair, MESSAGE);

    await expect(verifySignInSignature(MESSAGE, signature, keypair.toSuiAddress())).resolves.toBe(true);
  });

  test("rejects a signature presented for a different address", async () => {
    const signer = Ed25519Keypair.generate();
    const victim = Ed25519Keypair.generate();
    const signature = await sign(signer, MESSAGE);

    await expect(verifySignInSignature(MESSAGE, signature, victim.toSuiAddress())).resolves.toBe(false);
  });

  test("rejects a signature over a different message (e.g. an old nonce)", async () => {
    const keypair = Ed25519Keypair.generate();
    const signature = await sign(keypair, `${MESSAGE}-old`);

    await expect(verifySignInSignature(MESSAGE, signature, keypair.toSuiAddress())).resolves.toBe(false);
  });

  test("rejects a malformed signature", async () => {
    const keypair = Ed25519Keypair.generate();

    await expect(verifySignInSignature(MESSAGE, "bm90LWEtc2lnbmF0dXJl", keypair.toSuiAddress())).resolves.toBe(
      false,
    );
  });
});
