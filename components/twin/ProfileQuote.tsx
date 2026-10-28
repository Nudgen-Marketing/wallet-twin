"use client";

import { useState } from "react";

/** The twin's profile in its own voice. Clamped on small screens so the chat stays near the top. */
export function ProfileQuote({ profile }: { profile: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rise border-l-2 border-signal pl-5">
      <p
        className={`font-display text-xl font-light leading-snug sm:text-2xl lg:line-clamp-none ${isExpanded ? "" : "line-clamp-4"}`}
      >
        <span className="text-signal">“</span>
        {profile}
        <span className="text-signal">”</span>
      </p>
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
        className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-signal hover:underline lg:hidden"
      >
        {isExpanded ? "Show less" : "Read full profile"}
      </button>
    </div>
  );
}
