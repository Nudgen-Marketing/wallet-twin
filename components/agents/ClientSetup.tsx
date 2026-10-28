"use client";

import { type KeyboardEvent, useId, useState } from "react";
import { CopyButton } from "@/components/agents/CopyButton";

interface ClientSetupProps {
  mcpUrl: string;
}

interface Recipe {
  id: string;
  label: string;
  steps: string[];
  snippet?: string;
}

function recipes(mcpUrl: string): Recipe[] {
  return [
    {
      id: "claude",
      label: "Claude",
      steps: [
        "In Claude (web or desktop) open Settings → Connectors → Add custom connector.",
        "Paste the MCP URL and click Add, then Connect.",
        "Sign in with your wallet and pick what Claude may do.",
      ],
      snippet: mcpUrl,
    },
    {
      id: "claude-code",
      label: "Claude Code",
      steps: ["Run this, then type /mcp in Claude Code and choose Authenticate."],
      snippet: `claude mcp add --transport http wallettwin ${mcpUrl}`,
    },
    {
      id: "chatgpt",
      label: "ChatGPT",
      steps: [
        "Settings → Apps & Connectors → Advanced → turn on Developer mode.",
        "Create a connector with the MCP URL and OAuth authentication.",
        "Sign in with your wallet when ChatGPT asks.",
      ],
      snippet: mcpUrl,
    },
    {
      id: "cursor",
      label: "Cursor",
      steps: ["Add this to ~/.cursor/mcp.json, then click Connect next to wallettwin in Cursor's MCP settings."],
      snippet: JSON.stringify({ mcpServers: { wallettwin: { url: mcpUrl } } }, null, 2),
    },
    {
      id: "vscode",
      label: "VS Code",
      steps: ["Add this to .vscode/mcp.json and start the server from the MCP view."],
      snippet: JSON.stringify({ servers: { wallettwin: { type: "http", url: mcpUrl } } }, null, 2),
    },
    {
      id: "api-key",
      label: "API key",
      steps: [
        "For scripts and agents without OAuth: create a key below and send it as a bearer token.",
        "Any MCP client that supports custom headers works the same way.",
      ],
      snippet: JSON.stringify(
        { mcpServers: { wallettwin: { url: mcpUrl, headers: { Authorization: "Bearer <your wt_key_ API key>" } } } },
        null,
        2,
      ),
    },
    {
      id: "stdio",
      label: "stdio only",
      steps: ["Clients that only launch local commands can bridge to the remote server with mcp-remote."],
      snippet: JSON.stringify({ mcpServers: { wallettwin: { command: "npx", args: ["-y", "mcp-remote", mcpUrl] } } }, null, 2),
    },
  ];
}

/** Tabbed setup instructions per MCP client (WAI-ARIA tabs, arrow-key navigation). */
export function ClientSetup({ mcpUrl }: ClientSetupProps) {
  const items = recipes(mcpUrl);
  const [active, setActive] = useState(items[0].id);
  const baseId = useId();
  const current = items.find((item) => item.id === active) ?? items[0];

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = items.findIndex((item) => item.id === active);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = items[(index + step + items.length) % items.length];
    setActive(next.id);
    document.getElementById(`${baseId}-tab-${next.id}`)?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label="MCP client" className="flex flex-wrap gap-1 border-b border-rule">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              id={`${baseId}-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${baseId}-panel`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(item.id)}
              onKeyDown={onKeyDown}
              className={`-mb-px border-b-2 px-3 py-2 font-mono text-[0.72rem] uppercase tracking-[0.16em] transition-colors duration-150 ${
                isActive ? "border-signal text-signal" : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${current.id}`} className="pt-5">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft marker:text-signal">
          {current.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {current.snippet && (
          <div className="mt-4 flex items-start gap-2">
            <pre className="min-w-0 flex-1 overflow-x-auto border border-rule bg-paper-deep p-3 font-mono text-[0.8rem] leading-relaxed text-cyan">
              {current.snippet}
            </pre>
            <CopyButton value={current.snippet} />
          </div>
        )}
      </div>
    </div>
  );
}
