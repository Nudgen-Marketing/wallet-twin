/** Shapes on a 384 slab, shared with public/brand/*.svg and app/icon.svg. */
const SLAB = "56,0 384,0 384,328 328,384 0,384 0,56";
const MONOGRAM = "48,72 96,72 132,236 168,126 216,126 252,236 288,72 336,72 280,312 232,312 192,192 152,312 104,312";

// Sandevistan afterimages, farthest first; hovering the parent `.group` spreads them out.
const TRAIL = [
  { fill: "var(--sandy-1)", x: -90, hover: "group-hover:-translate-x-[60px]" },
  { fill: "var(--sandy-2)", x: -60, hover: "group-hover:-translate-x-[40px]" },
  { fill: "var(--sandy-3)", x: -30, hover: "group-hover:-translate-x-[20px]" },
] as const;

interface BrandMarkProps {
  className?: string;
}

/** The WalletTwin mark: a chamfered yellow slab with a fringed W, its cyan twin and a trail. */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <g transform="translate(16 10) scale(0.1146)">
        {TRAIL.map((ghost) => (
          <polygon
            key={ghost.fill}
            points={SLAB}
            fill={ghost.fill}
            transform={`translate(${ghost.x} 0)`}
            className={`transition-transform duration-300 ease-[var(--ease-out-expo)] ${ghost.hover}`}
          />
        ))}
        <polygon points={SLAB} fill="none" stroke="var(--cyan)" strokeWidth="14" transform="translate(22 22)" />
        <polygon points={SLAB} fill="var(--signal)" />
        <polygon points={MONOGRAM} fill="var(--fringe)" transform="translate(11 11)" />
        <polygon points={MONOGRAM} fill="var(--signal-ink)" />
      </g>
    </svg>
  );
}
