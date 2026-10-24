"use client";

import { DAppKitProvider, useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { formatAddress, normalizeSuiAddress } from "@mysten/sui/utils";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchSession, requestNonce, signOut, verifySignIn } from "@/lib/wallet/auth-client";
import { dAppKit } from "@/lib/wallet/dapp-kit";

export function WalletPanel() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <SignInFlow />
    </DAppKitProvider>
  );
}

type Status = "idle" | "signing" | "signing-out";

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/reject|denied|cancel/i.test(message)) return "Signature request was cancelled.";
  return message || "Sign-in failed. Please try again.";
}

function SignInFlow() {
  const router = useRouter();
  const kit = useDAppKit();
  const account = useCurrentAccount();
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    fetchSession()
      .then((session) => isCurrent && setSessionAddress(session.address))
      .catch(() => isCurrent && setSessionAddress(null));
    return () => {
      isCurrent = false;
    };
  }, []);

  const walletAddress = account ? normalizeSuiAddress(account.address) : null;
  // The server session is the source of truth; a different connected wallet means "switch account".
  const isSignedIn =
    sessionAddress !== null && (walletAddress === null || walletAddress === sessionAddress);

  const handleSignIn = useCallback(async () => {
    if (!walletAddress) return;
    setStatus("signing");
    setError(null);
    try {
      const { nonce, message } = await requestNonce(walletAddress);
      const { signature } = await kit.signPersonalMessage({
        message: new TextEncoder().encode(message),
      });
      const session = await verifySignIn({ address: walletAddress, nonce, signature });
      setSessionAddress(session.address);
      router.push("/sync");
      router.refresh();
    } catch (caught: unknown) {
      setError(describeError(caught));
    } finally {
      setStatus("idle");
    }
  }, [kit, router, walletAddress]);

  const handleSignOut = useCallback(async () => {
    setStatus("signing-out");
    setError(null);
    try {
      await signOut();
      setSessionAddress(null);
      if (account) await kit.disconnectWallet();
      router.refresh();
    } catch (caught: unknown) {
      setError(describeError(caught));
    } finally {
      setStatus("idle");
    }
  }, [account, kit, router]);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {isSignedIn && sessionAddress ? (
          <>
            <span className="font-mono text-xs text-ink-soft" title={sessionAddress}>
              <span className="mr-1.5 inline-block size-2 rounded-full bg-gain align-middle" aria-hidden />
              {formatAddress(sessionAddress)}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={status !== "idle"}
              className="rounded-sm border border-ink px-3 py-2 font-mono text-xs uppercase tracking-widest transition-colors duration-150 hover:bg-ink hover:text-paper disabled:opacity-50"
            >
              {status === "signing-out" ? "Signing out…" : "Sign out"}
            </button>
          </>
        ) : (
          <>
            <ConnectButton>Connect wallet</ConnectButton>
            {walletAddress && (
              <button
                type="button"
                onClick={handleSignIn}
                disabled={status !== "idle"}
                className="rounded-sm bg-signal px-4 py-2 font-mono text-xs uppercase tracking-widest text-signal-ink shadow-[3px_3px_0_var(--ink)] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-60"
              >
                {status === "signing"
                  ? "Check your wallet…"
                  : sessionAddress
                    ? "Switch to this wallet"
                    : "Sign in"}
              </button>
            )}
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="max-w-xs text-right text-xs text-loss">
          {error}
        </p>
      )}
    </div>
  );
}
