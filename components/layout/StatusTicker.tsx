"use client";

import { useEffect, useState } from "react";
import { apiCall } from "@/lib/http/client";
import { SPOT_TOKENS, type SpotPrice, type SpotSnapshot } from "@/lib/market/tokens";

const POLL_MS = 60_000;
// One set of three prices is narrower than a wide screen; repeat it so each half of the loop fills the bar.
const REPEATS_PER_HALF = 4;

const PLACEHOLDER: SpotPrice[] = SPOT_TOKENS.map(({ symbol }) => ({ symbol, usd: null, change24h: null }));

function formatUsd(usd: number | null): string {
  if (usd === null) return "—";
  return usd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumSignificantDigits: 4,
    maximumSignificantDigits: 4,
  });
}

function formatChange(change: number): string {
  return `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(2)}%`;
}

/** Polls our cached price route; skips polls while the tab is hidden and keeps the last good prices on error. */
function useSpotPrices(): SpotPrice[] {
  const [prices, setPrices] = useState<SpotPrice[]>(PLACEHOLDER);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (document.hidden) return;
      try {
        const snapshot = await apiCall<SpotSnapshot>("/api/prices");
        if (!cancelled) setPrices(snapshot.prices);
      } catch {
        // Keep whatever is on screen; the next poll retries.
      }
    }
    load();
    const timer = setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  return prices;
}

function PriceReadout({ price }: { price: SpotPrice }) {
  const { change24h } = price;
  return (
    <span className="flex shrink-0 items-center gap-3 px-6 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-ink-soft">
      <span className="size-1 bg-signal" />
      <span className="text-ink">{price.symbol}</span>
      <span className="tabular-nums">{formatUsd(price.usd)}</span>
      {change24h !== null && (
        <span className={`tabular-nums ${change24h >= 0 ? "text-gain" : "text-loss"}`}>{formatChange(change24h)}</span>
      )}
    </span>
  );
}

/** Scrolling strip of live SUI / DEEP / WAL spot prices (USD, 24h change). */
export function StatusTicker() {
  const prices = useSpotPrices();
  const half = Array.from({ length: REPEATS_PER_HALF }, () => prices).flat();
  const items = [...half, ...half];
  const summary = prices.map((p) => `${p.symbol} ${formatUsd(p.usd)}`).join(", ");

  return (
    <div className="overflow-hidden border-t border-rule/60 bg-paper-deep/70 py-1">
      <p className="sr-only">Spot prices: {summary}</p>
      <div aria-hidden className="ticker-track">
        {items.map((price, index) => (
          <PriceReadout key={index} price={price} />
        ))}
      </div>
    </div>
  );
}
