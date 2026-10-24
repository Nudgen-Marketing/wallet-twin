import { formatAddress } from "@mysten/sui/utils";
import type { WrappedCard } from "@/lib/wrapped/data";
import { formatDate, formatDuration, formatPercent, formatUsd } from "@/lib/twin/format";

/**
 * The 1200×630 Wrapped card, rendered by next/og (Satori: flexbox only, inline styles).
 * Colours are hex mirrors of the CSS tokens in app/globals.css (Satori can't read oklch).
 */
const COLOR = {
  paper: "#F6F0E4",
  paperDeep: "#ECE3D2",
  ink: "#231E1A",
  inkSoft: "#5E554C",
  rule: "#CDBFA8",
  signal: "#E0442A",
  gain: "#2E7D4F",
  loss: "#C2362B",
} as const;

export const WRAPPED_SIZE = { width: 1200, height: 630 } as const;

/** Satori mis-draws Fraunces' "+" glyph, so signs are set in the mono face. */
function splitSign(value: string): { sign: string; rest: string } {
  const match = /^([+−-])(.*)$/.exec(value);
  return match ? { sign: match[1], rest: match[2] } : { sign: "", rest: value };
}

function Stat({ label, value, color = COLOR.ink }: { label: string; value: string; color?: string }) {
  const { sign, rest } = splitSign(value);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, borderTop: `3px solid ${COLOR.ink}`, paddingTop: 14, marginRight: 28 }}>
      <div style={{ display: "flex", fontFamily: "IBM Plex Mono", fontSize: 18, letterSpacing: 3, textTransform: "uppercase", color: COLOR.inkSoft }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", fontFamily: "Fraunces", fontWeight: 900, fontSize: 64, lineHeight: 1.05, color, marginTop: 6 }}>
        {sign && <span style={{ fontFamily: "IBM Plex Mono", fontWeight: 500, fontSize: 52, marginRight: 4 }}>{sign}</span>}
        {rest}
      </div>
    </div>
  );
}

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
        fontFamily: "Fraunces",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `4px solid ${COLOR.ink}`, paddingBottom: 14 }}>
        <div style={{ display: "flex", fontWeight: 900, fontSize: 44, letterSpacing: -1 }}>
          Wallet<span style={{ color: COLOR.signal }}>Wrapped</span>
        </div>
        <div style={{ display: "flex", fontFamily: "IBM Plex Mono", fontSize: 20, letterSpacing: 2, color: COLOR.inkSoft }}>
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
        <div style={{ display: "flex", fontStyle: "italic", fontWeight: 400, fontSize: 38, lineHeight: 1.2, color: COLOR.ink, maxWidth: 1088 }}>
          “{card.line}”
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", borderTop: `2px solid ${COLOR.rule}`, paddingTop: 12, fontFamily: "IBM Plex Mono", fontSize: 18, color: COLOR.inkSoft }}>
        <div style={{ display: "flex" }}>{formatAddress(card.address)} · estimates, not financial advice</div>
        <div style={{ display: "flex" }}>WalletTwin · data via Tatum · memory on Walrus</div>
      </div>
    </div>
  );
}
