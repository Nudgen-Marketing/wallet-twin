"use client";

import { useState } from "react";

interface CopyButtonProps {
  value: string;
  label?: string;
}

const RESET_MS = 1_600;

export function CopyButton({ value, label = "Copy" }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), RESET_MS);
  }

  return (
    <button type="button" onClick={copy} className="btn btn-ghost btn-sm shrink-0" aria-live="polite">
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
    </button>
  );
}

interface CopyFieldProps {
  label: string;
  value: string;
  hint?: string;
}

/** A labelled, selectable value with a copy button, for URLs and one-time secrets. */
export function CopyField({ label, value, hint }: CopyFieldProps) {
  return (
    <div>
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink-soft">{label}</p>
      <div className="mt-1.5 flex items-stretch gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap border border-rule bg-paper-deep px-3 py-2 font-mono text-sm text-cyan">
          {value}
        </code>
        <CopyButton value={value} />
      </div>
      {hint && <p className="mt-1.5 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}
