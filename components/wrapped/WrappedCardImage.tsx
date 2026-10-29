import { formatAddress } from "@mysten/sui/utils";
import { CARD_SIZE, COLOR, DISPLAY, MONO, Stat } from "@/components/og/primitives";
import { formatDate, formatDuration, formatPercent, formatUsd } from "@/lib/twin/format";
import type { WrappedCard } from "@/lib/wrapped/data";

/** The 1200×630 Wrapped card, rendered by next/og. */
export const WRAPPED_SIZE = CARD_SIZE;

export function WrappedCardImage({ card }: { card: WrappedCard }) {
  const pnlColor = card.realizedPnlUsd === null ? COLOR.ink : card.realizedPnlUsd >= 0 ? COLOR.gain : COLOR.loss;
  const period =
    card.fromMs && card.toMs ? `${formatDate(card.fromMs)} → ${formatDate(card.toMs)}` : "No activity yet";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: COLOR.paper,
        color: COLOR.ink,
        padding: "48px 56px",
        fontFamily: DISPLAY,
        backgroundImage: `linear-gradient(${COLOR.rule}55 1px, transparent 1px), linear-gradient(90deg, ${COLOR.rule}55 1px, transparent 1px)`,
        backgroundSize: "56px 56px",
        borderLeft: `10px solid ${COLOR.signal}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `2px solid ${COLOR.signal}`, paddingBottom: 14 }}>
        <div style={{ display: "flex", fontWeight: 700, fontSize: 44, letterSpacing: 2, textTransform: "uppercase" }}>
          Wallet<span style={{ color: COLOR.signal }}>{"//"}</span>Wrapped
        </div>
        <div style={{ display: "flex", fontFamily: MONO, fontSize: 19, letterSpacing: 2, color: COLOR.inkSoft }}>
          SUI · {period}
        </div>
      </div>

      <div style={{ display: "flex", marginTop: 34 }}>
        <Stat label="Swaps" value={card.swaps.toLocaleString("en-US")} />
        <Stat label="Win rate" value={formatPercent(card.winRate)} />
        <Stat
          label="Realized PnL"
          value={card.realizedPnlUsd === null ? "—" : formatUsd(card.realizedPnlUsd, { signed: true })}
          color={pnlColor}
        />
      </div>
      <div style={{ display: "flex", marginTop: 26 }}>
        <Stat label="Favorite token" value={card.favoriteToken ?? "—"} color={COLOR.signal} />
        <Stat label="Avg holding" value={card.avgHoldingMs === null ? "—" : formatDuration(card.avgHoldingMs)} />
        <Stat
          label="Best trade"
          value={card.biggestWin ? formatUsd(card.biggestWin.pnlUsd, { signed: true }) : "—"}
          color={card.biggestWin ? COLOR.gain : COLOR.ink}
        />
      </div>

      <div style={{ display: "flex", flex: 1, alignItems: "center", marginTop: 18 }}>
        <div style={{ display: "flex", fontWeight: 400, fontSize: 36, lineHeight: 1.25, color: COLOR.ink, maxWidth: 1078, borderLeft: `3px solid ${COLOR.cyan}`, paddingLeft: 22 }}>
          “{card.line}”
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", borderTop: `2px solid ${COLOR.rule}`, paddingTop: 12, fontFamily: MONO, fontSize: 17, color: COLOR.inkSoft }}>
        <div style={{ display: "flex" }}>{formatAddress(card.address)} · estimates, not financial advice</div>
        <div style={{ display: "flex" }}>WalletTwin · data via Tatum · memory on Walrus</div>
      </div>
    </div>
  );
}
