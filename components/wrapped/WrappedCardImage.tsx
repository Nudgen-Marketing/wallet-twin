import { formatAddress } from "@mysten/sui/utils";
import type { WrappedCard } from "@/lib/wrapped/data";
import { formatDate, formatDuration, formatPercent, formatUsd } from "@/lib/twin/format";

/**
 * The 1200×630 Wrapped card, rendered by next/og (Satori: flexbox only, inline styles).
 * Colours are hex mirrors of the CSS tokens in app/globals.css (Satori can't read oklch).
 */
const COLOR = {
  paper: "#060911",
  paperDeep: "#0E131D",
  ink: "#F1EFE2",
  inkSoft: "#9FACBA",
  rule: "#2D3645",
  signal: "#FAE91D",
  cyan: "#4AEBEB",
  gain: "#54F08D",
  loss: "#FF4260",
} as const;

const DISPLAY = "Chakra Petch";
const MONO = "JetBrains Mono";

export const WRAPPED_SIZE = { width: 1200, height: 630 } as const;

/** Signs are set in the mono face so +/− line up across stats. */
function splitSign(value: string): { sign: string; rest: string } {
  const match = /^([+−-])(.*)$/.exec(value);
  return match ? { sign: match[1], rest: match[2] } : { sign: "", rest: value };
}

function Stat({ label, value, color = COLOR.ink }: { label: string; value: string; color?: string }) {
  const { sign, rest } = splitSign(value);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, borderTop: `2px solid ${COLOR.rule}`, paddingTop: 14, marginRight: 28, position: "relative" }}>
      <div style={{ display: "flex", position: "absolute", top: -2, left: 0, width: 36, height: 2, backgroundColor: COLOR.signal }} />
      <div style={{ display: "flex", fontFamily: MONO, fontSize: 17, letterSpacing: 3, textTransform: "uppercase", color: COLOR.inkSoft }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", fontFamily: DISPLAY, fontWeight: 700, fontSize: 62, lineHeight: 1.05, color, marginTop: 6 }}>
        {sign && <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 52, marginRight: 4 }}>{sign}</span>}
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
