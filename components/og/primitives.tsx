/**
 * Building blocks for the 1200×630 cards rendered by next/og (Satori: flexbox only, inline styles).
 * Colours are hex mirrors of the CSS tokens in app/globals.css (Satori can't read oklch).
 */
import type { ReactNode } from "react";

export const COLOR = {
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

export const CARD_SIZE = { width: 1200, height: 630 } as const;

export const DISPLAY = "Chakra Petch";
export const MONO = "JetBrains Mono";

/** Signs are set in the mono face so +/− line up across stats. */
function splitSign(value: string): { sign: string; rest: string } {
  const match = /^([+−-])(.*)$/.exec(value);
  return match ? { sign: match[1], rest: match[2] } : { sign: "", rest: value };
}

export function Stat({ label, value, color = COLOR.ink }: { label: string; value: string; color?: string }) {
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

/** The WalletTwin "W" mark from app/icon.svg, drawn inline so cards need no file reads. */
export function BrandMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <polygon points="12.17,4 60,4 60,51.83 51.83,60 4,60 4,12.17" fill={COLOR.signal} />
      <polygon
        points="12.57,16.07 19.57,16.07 24.82,39.98 30.07,23.94 37.07,23.94 42.32,39.98 47.57,16.07 54.57,16.07 46.4,51.07 39.4,51.07 33.57,33.57 27.73,51.07 20.73,51.07"
        fill="#FD1623"
      />
      <polygon
        points="11,14.5 18,14.5 23.25,38.42 28.5,22.38 35.5,22.38 40.75,38.42 46,14.5 53,14.5 44.83,49.5 37.83,49.5 32,32 26.17,49.5 19.17,49.5"
        fill="#070B14"
      />
    </svg>
  );
}

/** Grid paper with the signal edge: the shared backdrop of every card. */
export function CardFrame({ children }: { children: ReactNode }) {
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
      {children}
    </div>
  );
}

/** Mark + "WALLET//TWIN" wordmark on the left, a mono label on the right. */
export function BrandBar({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2px solid ${COLOR.signal}`, paddingBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <BrandMark size={56} />
        <div style={{ display: "flex", marginLeft: 18, fontWeight: 700, fontSize: 40, letterSpacing: 2, textTransform: "uppercase" }}>
          Wallet<span style={{ color: COLOR.signal }}>{"//"}</span>Twin
        </div>
      </div>
      <div style={{ display: "flex", fontFamily: MONO, fontSize: 19, letterSpacing: 3, textTransform: "uppercase", color: COLOR.inkSoft }}>
        {label}
      </div>
    </div>
  );
}

/** The bottom rule: site address on the left, data credits on the right. */
export function CardFooter({ left }: { left: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", borderTop: `2px solid ${COLOR.rule}`, paddingTop: 12, fontFamily: MONO, fontSize: 17, color: COLOR.inkSoft }}>
      <div style={{ display: "flex" }}>{left}</div>
      <div style={{ display: "flex" }}>data via Tatum · memory on Walrus</div>
    </div>
  );
}
