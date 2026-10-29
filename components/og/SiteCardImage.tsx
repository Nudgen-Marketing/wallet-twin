import { BrandBar, CardFooter, CardFrame, COLOR, DISPLAY } from "@/components/og/primitives";

/** The site-wide link preview: the promise of the product in one line. */
export function SiteCardImage({ host }: { host: string }) {
  return (
    <CardFrame>
      <BrandBar label="Sui mainnet · AI wallet twin" />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", fontFamily: DISPLAY, fontWeight: 700, fontSize: 68, lineHeight: 1, textTransform: "uppercase", letterSpacing: -1 }}>
          <div style={{ display: "flex" }}>Your wallet has a memory.</div>
          <div style={{ display: "flex", color: COLOR.signal, marginTop: 8 }}>Meet the twin that kept it.</div>
        </div>
        <div style={{ display: "flex", marginTop: 36, fontWeight: 400, fontSize: 30, lineHeight: 1.3, color: COLOR.inkSoft, borderLeft: `3px solid ${COLOR.cyan}`, paddingLeft: 22, maxWidth: 980 }}>
          Chat with an AI twin built from a Sui wallet&apos;s on-chain history: its trades, habits, wins and worst calls.
        </div>
      </div>
      <CardFooter left={host} />
    </CardFrame>
  );
}
