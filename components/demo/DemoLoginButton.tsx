"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiCall } from "@/lib/http/client";

interface DemoLoginButtonProps {
  address: string;
  /** Where to go after signing in; omit to open the twin. Null stays on the current page. */
  next?: string | null;
  label?: string;
}

export function DemoLoginButton({ address, next = "/twin/me", label = "Explore as this wallet" }: DemoLoginButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function explore() {
    setIsLoading(true);
    setError(null);
    try {
      await apiCall("/api/auth/demo", { method: "POST", body: JSON.stringify({ address }) });
      if (next) router.push(next);
      router.refresh();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Couldn't open the demo.");
      setIsLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={explore}
        disabled={isLoading}
        className="btn btn-volt btn-sm"
      >
        {isLoading ? "Opening…" : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-loss">
          {error}
        </p>
      )}
    </>
  );
}
