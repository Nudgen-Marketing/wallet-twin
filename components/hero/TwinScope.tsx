const TICKS = Array.from({ length: 60 }, (_, index) => index);
const READOUTS = [
  { label: "Source", value: "Tatum · Sui" },
  { label: "Memory", value: "Walrus" },
  { label: "Mode", value: "Twin sync" },
] as const;

/** Decorative HUD for the hero: counter-rotating rings around a twin glyph. */
export function TwinScope() {
  return (
    <div aria-hidden className="hud-frame relative mx-auto aspect-square w-full max-w-[26rem] p-6">
      <svg viewBox="0 0 400 400" className="h-full w-full overflow-visible">
        <g className="spin-slow origin-center [transform-box:fill-box]">
          {TICKS.map((tick) => (
            <line
              key={tick}
              x1="200"
              y1="12"
              x2="200"
              y2={tick % 5 === 0 ? 30 : 20}
              stroke={tick % 15 === 0 ? "var(--signal)" : "var(--rule)"}
              strokeWidth={tick % 5 === 0 ? 2 : 1}
              transform={`rotate(${tick * 6} 200 200)`}
            />
          ))}
        </g>
        <g className="spin-slow-reverse origin-center [transform-box:fill-box]">
          <circle cx="200" cy="200" r="140" fill="none" stroke="var(--signal)" strokeWidth="2" strokeDasharray="120 40 12 40" opacity="0.85" />
          <circle cx="200" cy="200" r="122" fill="none" stroke="var(--cyan)" strokeWidth="1" strokeDasharray="4 10" opacity="0.6" />
        </g>
        <circle cx="200" cy="200" r="96" fill="var(--paper-deep)" stroke="var(--rule)" />
        <circle cx="200" cy="200" r="96" fill="none" stroke="var(--signal)" strokeWidth="1" strokeDasharray="2 6" opacity="0.5" />
        {/* Sandevistan afterimages trailing off the glyph. */}
        <polygon className="ghost-drift" points="170,150 228,150 248,200 228,250 170,250 190,200" fill="var(--sandy-2)" />
        <polygon className="ghost-drift-late" points="170,150 228,150 248,200 228,250 170,250 190,200" fill="var(--sandy-3)" />
        {/* Two overlapping facets: the wallet and its twin. */}
        <polygon points="170,150 228,150 248,200 228,250 170,250 190,200" fill="var(--signal)" />
        <polygon points="190,165 236,165 252,200 236,235 190,235 206,200" fill="none" stroke="var(--cyan)" strokeWidth="2" />
        <text x="200" y="290" textAnchor="middle" fill="var(--ink-soft)" fontFamily="var(--font-jetbrains)" fontSize="11" letterSpacing="4">
          TWIN · ONLINE
        </text>
      </svg>
      <dl className="absolute -bottom-3 left-6 right-6 grid grid-cols-3 gap-px bg-rule font-mono text-[0.6rem] uppercase tracking-[0.18em]">
        {READOUTS.map((readout) => (
          <div key={readout.label} className="bg-paper px-2 py-1.5">
            <dt className="text-ink-soft">{readout.label}</dt>
            <dd className="text-signal">{readout.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
