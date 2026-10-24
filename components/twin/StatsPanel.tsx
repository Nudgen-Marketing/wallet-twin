import type { TwinStats } from "@/lib/trades/stats";
import { formatDate, formatDuration, formatPercent, formatUsd } from "@/lib/twin/format";

interface StatsPanelProps {
  stats: TwinStats;
  historyFromMs: number | null;
}

function Figure({ label, value, tone, note }: { label: string; value: string; tone?: "gain" | "loss"; note?: string }) {
  const color = tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink";
  return (
    <div className="border-t border-ink pt-3">
      <dt className="font-mono text-[0.7rem] uppercase tracking-widest text-ink-soft">{label}</dt>
      <dd className={`mt-1 font-display text-4xl font-black tabular-nums tracking-tight ${color}`}>{value}</dd>
      {note && <dd className="mt-1 font-mono text-xs text-ink-soft">{note}</dd>}
    </div>
  );
}

export function StatsPanel({ stats, historyFromMs }: StatsPanelProps) {
  const pnlTone = stats.realizedPnlUsd > 0 ? "gain" : stats.realizedPnlUsd < 0 ? "loss" : undefined;
  const maxTrades = Math.max(1, ...stats.favoriteTokens.map((token) => token.trades));

  return (
    <section aria-labelledby="stats-heading">
      <h2 id="stats-heading" className="font-mono text-xs uppercase tracking-widest text-signal">
        The numbers
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-6">
        <Figure
          label="Realized PnL (est.)"
          value={stats.closedTrades > 0 ? formatUsd(stats.realizedPnlUsd, { signed: true }) : "—"}
          tone={pnlTone}
          note={`${stats.closedTrades} closed trades`}
        />
        <Figure label="Win rate" value={formatPercent(stats.winRate)} note={`${stats.wins} winners`} />
        <Figure
          label="Total swaps"
          value={stats.swapCount.toLocaleString()}
          note={`${formatUsd(stats.tradedVolumeUsd)} priced volume`}
        />
        <Figure
          label="Avg holding"
          value={stats.avgHoldingMs === null ? "—" : formatDuration(stats.avgHoldingMs)}
          note="sold positions"
        />
      </dl>

      <div className="mt-8 border-t border-ink pt-3">
        <h3 className="font-mono text-[0.7rem] uppercase tracking-widest text-ink-soft">Favorite tokens</h3>
        {stats.favoriteTokens.length === 0 ? (
          <p className="mt-2 text-ink-soft">No swaps yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {stats.favoriteTokens.map((token) => (
              <li key={token.coinType} className="grid grid-cols-[5rem_1fr_3rem] items-center gap-3 font-mono text-sm">
                <span className="truncate" title={token.coinType}>
                  {token.symbol ?? "?"}
                </span>
                <span className="h-2 bg-paper-deep" aria-hidden>
                  <span className="block h-full bg-ink" style={{ width: `${(token.trades / maxTrades) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums text-ink-soft">{token.trades}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-ink-soft">
        Estimates from on-chain data read through Tatum
        {historyFromMs ? `, indexed since ${formatDate(historyFromMs)}` : ""}. USD values use Tatum
        historical prices (≈USD, quoted in USDT); trades without a reliable price are left out of PnL,
        never guessed.
      </p>
    </section>
  );
}
