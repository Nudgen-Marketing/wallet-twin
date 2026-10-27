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
        className="btn btn-ghost"
      >
        Download PNG
      </a>
      <a
        href={intent}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-volt"
      >
        Share on X
      </a>
      <button
        type="button"
        onClick={copyLink}
        className="btn btn-ghost"
      >
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}
