interface MemoryBadgeProps {
  backend: "walrus" | "local";
}

/** Always tells the viewer where the twin's memory actually lives. */
export function MemoryBadge({ backend }: MemoryBadgeProps) {
  if (backend === "walrus") {
    return (
      <span className="inline-flex items-center gap-2 rounded-sm border border-ink px-2 py-1 font-mono text-[0.7rem] uppercase tracking-widest">
        <span className="size-1.5 rounded-full bg-gain" aria-hidden />
        Memory · Walrus
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-2 rounded-sm border border-loss px-2 py-1 font-mono text-[0.7rem] uppercase tracking-widest text-loss"
      title="MEMWAL_PRIVATE_KEY / MEMWAL_ACCOUNT_ID are not set, so memories are kept in a local development store."
    >
      Memory · local stand-in (Walrus not configured)
    </span>
  );
}
