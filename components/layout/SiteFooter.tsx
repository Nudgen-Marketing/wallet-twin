export function SiteFooter() {
  return (
    <footer className="relative mt-10 border-t border-rule bg-paper-deep/60">
      <div aria-hidden className="absolute -top-px left-0 h-0.5 w-40 bg-signal" />
      <div className="mx-auto flex max-w-6xl px-4 py-8 sm:justify-end sm:px-8">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-ink-soft">
          Data via <span className="text-ink">Tatum</span> · Memory on <span className="text-ink">Walrus</span>
        </p>
      </div>
    </footer>
  );
}
