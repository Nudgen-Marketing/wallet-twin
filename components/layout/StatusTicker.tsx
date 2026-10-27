const READOUTS = [
  "Sui mainnet · link stable",
  "History feed · Tatum gateway",
  "Memory core · Walrus",
  "Copy trading · simulated only",
  "No funds ever move",
  "Not financial advice",
] as const;

/** Decorative scrolling status strip; the same facts are stated in plain text elsewhere. */
export function StatusTicker() {
  const items = [...READOUTS, ...READOUTS];
  return (
    <div aria-hidden className="overflow-hidden border-t border-rule/60 bg-paper-deep/70 py-1">
      <div className="ticker-track">
        {items.map((item, index) => (
          <span
            key={index}
            className="flex shrink-0 items-center gap-3 px-6 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-ink-soft"
          >
            <span className="size-1 bg-signal" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
