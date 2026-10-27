const PRIMARY = ["Your chain remembers", "Meet the twin", "Paper-copy the legends", "No real funds move"] as const;
const SECONDARY = ["Tatum link", "Walrus memory", "Sui mainnet", "Simulated copy trading"] as const;

interface BandProps {
  items: readonly string[];
  className: string;
  trackClassName: string;
}

function Band({ items, className, trackClassName }: BandProps) {
  const loop = [...items, ...items, ...items, ...items];
  return (
    <div className={`flood-band w-[110%] -translate-x-[5%] overflow-hidden ${className}`}>
      <div className={trackClassName}>
        {loop.map((item, index) => (
          <span key={index} className="flex shrink-0 items-center gap-6 px-6">
            {item}
            <span className="font-mono">{"//"}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Decorative crossing caution bands: Trigger-style flat colour flood between sections. */
export function FloodBand() {
  return (
    <div aria-hidden className="relative overflow-x-clip py-10 sm:py-14">
      <Band
        items={SECONDARY}
        className="absolute inset-x-0 top-[68%] -translate-y-1/2 rotate-[2.5deg] bg-magenta py-2 text-sm tracking-[0.3em] text-signal-ink"
        trackClassName="ticker-track-reverse"
      />
      <Band
        items={PRIMARY}
        className="relative -rotate-[2deg] bg-signal py-3 text-2xl tracking-[0.06em] text-signal-ink shadow-[0_10px_0_-4px_var(--fringe)] sm:text-4xl"
        trackClassName="ticker-track"
      />
    </div>
  );
}
