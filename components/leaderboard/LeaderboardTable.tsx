import { formatAddress } from "@mysten/sui/utils";
import Link from "next/link";
import type { LeaderboardRow } from "@/lib/twin/publish";
import { formatPercent, formatUsd } from "@/lib/twin/format";

interface LeaderboardTableProps {
  rows: LeaderboardRow[];
  /** Compact mode for the landing page. */
  compact?: boolean;
}

function signedPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}%`;
}

function tone(value: number | null): string {
  if (value === null || value === 0) return "";
  return value > 0 ? "text-gain" : "text-loss";
}

export function LeaderboardTable({ rows, compact = false }: LeaderboardTableProps) {
  if (rows.length === 0) {
    return (
      <p className="panel mt-6 max-w-lg p-5 text-ink-soft">
        No public twins yet. Sync your wallet and publish yours to be the first on the board.
      </p>
    );
  }

  return (
    <ol className="mt-8 border-y border-rule">
      {rows.map((row) => (
        <li key={row.address} className="reveal border-b border-rule/60 last:border-b-0">
          <Link
            href={`/twin/${row.address}`}
            className="group relative grid grid-cols-[3rem_1fr] items-baseline gap-x-4 gap-y-2 px-3 py-5 transition-colors duration-200 hover:bg-paper-deep/80 sm:grid-cols-[4rem_minmax(0,1fr)_repeat(3,7rem)] sm:px-4"
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1 origin-top scale-y-0 bg-signal transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:scale-y-100"
            />
            <span
              className={`sandy-group font-display text-4xl font-bold tabular-nums leading-none transition-colors duration-150 ${
                row.rank <= 3 ? "text-signal" : "numeral-outline group-hover:text-signal"
              }`}
            >
              {String(row.rank).padStart(2, "0")}
            </span>
            <span className="min-w-0">
              <span className="font-mono text-sm transition-colors duration-150 group-hover:text-signal">{formatAddress(row.address)}</span>
              {row.favoriteToken && (
                <span className="ml-3 bg-signal/10 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-signal">{row.favoriteToken}</span>
              )}
              {!compact && row.headline && (
                <span className="mt-1 block truncate text-ink-soft group-hover:text-ink">{row.headline}</span>
              )}
            </span>
            <Metric label="Copy return" value={signedPercent(row.copyReturnPct)} className={tone(row.copyReturnPct)} />
            <Metric label="Win rate" value={formatPercent(row.winRate)} />
            <Metric
              label="Realized PnL"
              value={formatUsd(row.realizedPnlUsd, { signed: true })}
              className={tone(row.realizedPnlUsd)}
            />
          </Link>
        </li>
      ))}
    </ol>
  );
}

function Metric({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <span className="col-start-2 flex items-baseline justify-between gap-2 sm:col-start-auto sm:block sm:text-right">
      <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-soft sm:block">{label}</span>
      <span className={`font-mono text-lg font-medium tabular-nums ${className}`}>{value}</span>
    </span>
  );
}
