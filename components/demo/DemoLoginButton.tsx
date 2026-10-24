"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiCall } from "@/lib/http/client";

interface DemoLoginButtonProps {
  address: string;
}

export function DemoLoginButton({ address }: DemoLoginButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function explore() {
    setIsLoading(true);
    setError(null);
    try {
      await apiCall("/api/auth/demo", { method: "POST", body: JSON.stringify({ address }) });
      router.push("/twin/me");
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
        className="rounded-sm bg-ink px-4 py-2 font-mono text-xs uppercase tracking-widest text-paper transition-colors duration-150 hover:bg-signal hover:text-signal-ink disabled:opacity-50"
      >
        {isLoading ? "Opening…" : "Explore as this wallet"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-loss">
          {error}
        </p>
      )}
    </>
  );
}
