export function SiteFooter() {
  return (
    <footer className="relative mt-10 border-t border-rule bg-paper-deep/60">
      <div aria-hidden className="absolute -top-px left-0 h-0.5 w-40 bg-signal" />
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-[1fr_auto] sm:items-end sm:px-8">
        <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
          <strong className="font-semibold text-signal">Not financial advice.</strong> Past performance
          doesn&apos;t predict future results. Copy trading on WalletTwin is{" "}
          <strong className="font-semibold text-ink">simulated</strong>: no real trades are ever
          executed and no funds move.
        </p>
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-ink-soft">
          Data via <span className="text-ink">Tatum</span> · Memory on <span className="text-ink">Walrus</span>
        </p>
      </div>
    </footer>
  );
}
