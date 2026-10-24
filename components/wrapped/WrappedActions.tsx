"use client";

import { useState } from "react";

interface WrappedActionsProps {
  imagePath: string;
  shareUrl: string;
  shareText: string;
}

export function WrappedActions({ imagePath, shareUrl, shareText }: WrappedActionsProps) {
  const [copied, setCopied] = useState(false);
  const intent = `https://x.com/intent/post?${new URLSearchParams({ text: shareText, url: shareUrl })}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={imagePath}
        download="wallet-wrapped.png"
        className="rounded-sm bg-ink px-5 py-3 font-mono text-sm uppercase tracking-widest text-paper transition-transform duration-150 hover:-translate-y-0.5"
      >
        Download PNG
      </a>
      <a
        href={intent}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-sm bg-signal px-5 py-3 font-mono text-sm uppercase tracking-widest text-signal-ink shadow-[3px_3px_0_var(--ink)] transition-transform duration-150 hover:-translate-y-0.5"
      >
        Share on X
      </a>
      <button
        type="button"
        onClick={copyLink}
        className="rounded-sm border border-ink px-5 py-3 font-mono text-sm uppercase tracking-widest transition-colors duration-150 hover:bg-ink hover:text-paper"
      >
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}
