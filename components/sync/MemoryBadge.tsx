interface MemoryBadgeProps {
  backend: "walrus" | "local";
}

/** Always tells the viewer where the twin's memory actually lives. */
export function MemoryBadge({ backend }: MemoryBadgeProps) {
  if (backend === "walrus") {
    return (
      <span className="inline-flex items-center gap-2 border border-gain/50 bg-gain/5 px-2 py-1 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-gain">
        <span className="status-dot" aria-hidden />
        Memory · Walrus
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-2 border border-loss/60 bg-loss/5 px-2 py-1 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-loss"
      title="MEMWAL_PRIVATE_KEY / MEMWAL_ACCOUNT_ID are not set, so memories are kept in a local development store."
    >
      Memory · local stand-in (Walrus not configured)
    </span>
  );
}
