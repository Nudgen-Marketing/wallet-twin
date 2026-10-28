"use client";

import { DAppKitProvider, useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { formatAddress, normalizeSuiAddress } from "@mysten/sui/utils";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();
  const kit = useDAppKit();
  const account = useCurrentAccount();
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // Re-read the session on navigation: demo sign-in and sign-out happen outside this panel.
  useEffect(() => {
    let isCurrent = true;
    fetchSession()
      .then((session) => {
        if (!isCurrent) return;
        setSessionAddress(session.address);
        setIsDemo(session.demo);
      })
      .catch(() => isCurrent && setSessionAddress(null));
    return () => {
      isCurrent = false;
    };
  }, [pathname]);

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
      // Signing in mid-OAuth must return to the consent screen, not start a sync.
      if (!pathname.startsWith("/oauth/")) router.push("/sync");
      router.refresh();
    } catch (caught: unknown) {
      setError(describeError(caught));
    } finally {
      setStatus("idle");
    }
  }, [kit, pathname, router, walletAddress]);

  const handleSignOut = useCallback(async () => {
    setStatus("signing-out");
    setError(null);
    try {
      await signOut();
      setSessionAddress(null);
      setIsDemo(false);
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
            <span className="flex items-center font-mono text-xs text-ink" title={sessionAddress}>
              <span className="status-dot mr-2 text-gain" aria-hidden />
              {formatAddress(sessionAddress)}
              {isDemo && (
                <span className="ml-2 bg-signal px-1.5 py-0.5 text-[0.65rem] uppercase tracking-[0.15em] text-signal-ink">Demo</span>
              )}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={status !== "idle"}
              className="btn btn-ghost btn-sm"
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
                className="btn btn-volt btn-sm"
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
