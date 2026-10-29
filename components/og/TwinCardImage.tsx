import { formatAddress } from "@mysten/sui/utils";
import { BrandBar, CardFooter, CardFrame, COLOR, MONO, Stat } from "@/components/og/primitives";
import type { TwinSeo } from "@/lib/seo/twin";
import { formatPercent, formatSignedPercent, formatUsd } from "@/lib/twin/format";

const MAX_HEADLINE = 120;

function clamp(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** A published twin's link preview: who it is, how it trades, in numbers. */
export function TwinCardImage({ twin, host }: { twin: TwinSeo; host: string }) {
  const pnlColor = twin.realizedPnlUsd === null ? COLOR.ink : twin.realizedPnlUsd >= 0 ? COLOR.gain : COLOR.loss;
  const copyColor = twin.copyReturnPct === null ? COLOR.ink : twin.copyReturnPct >= 0 ? COLOR.gain : COLOR.loss;

  return (
    <CardFrame>
      <BrandBar label="Public twin · Sui" />
      <div style={{ display: "flex", alignItems: "baseline", marginTop: 30 }}>
        <div style={{ display: "flex", fontWeight: 700, fontSize: 64, textTransform: "uppercase", letterSpacing: -1 }}>Twin of</div>
        <div style={{ display: "flex", marginLeft: 22, fontFamily: MONO, fontWeight: 500, fontSize: 56, color: COLOR.signal }}>
          {formatAddress(twin.address)}
        </div>
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
        <div style={{ display: "flex", fontWeight: 400, fontSize: 34, lineHeight: 1.25, maxWidth: 1060, borderLeft: `3px solid ${COLOR.cyan}`, paddingLeft: 22 }}>
          {twin.headline ? `“${clamp(twin.headline, MAX_HEADLINE)}”` : "Ask this wallet why it traded the way it did."}
        </div>
      </div>
      <div style={{ display: "flex", marginBottom: 26 }}>
        <Stat label="Swaps" value={twin.swaps === null ? "—" : twin.swaps.toLocaleString("en-US")} />
        <Stat label="Win rate" value={formatPercent(twin.winRate)} />
        <Stat label="Realized PnL" value={twin.realizedPnlUsd === null ? "—" : formatUsd(twin.realizedPnlUsd, { signed: true })} color={pnlColor} />
        <Stat
          label="$1k paper copy"
          value={formatSignedPercent(twin.copyReturnPct)}
          color={copyColor}
        />
      </div>
      <CardFooter left={`${host}/twin · simulated, not financial advice`} />
    </CardFrame>
  );
}
