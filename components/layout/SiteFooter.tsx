export function SiteFooter() {
  return (
    <footer className="border-t border-ink/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-ink-soft sm:flex-row sm:items-start sm:justify-between sm:px-8">
        <p className="max-w-2xl">
          <strong className="font-semibold text-ink">Not financial advice.</strong> Past performance
          doesn&apos;t predict future results. Copy trading on WalletTwin is{" "}
          <strong className="font-semibold text-ink">simulated</strong>: no real trades are ever
          executed and no funds move.
        </p>
        <p className="font-mono text-xs uppercase tracking-widest">
          Data via Tatum · Memory on Walrus
        </p>
      </div>
    </footer>
  );
}
