"use client";

import { useState } from "react";
import { apiCall } from "@/lib/http/client";
import type { GrantView } from "@/lib/mcp/auth/oauth";
import { formatDateTime } from "@/lib/twin/format";

interface ConnectedAppsProps {
  initialGrants: GrantView[];
}

export function ConnectedApps({ initialGrants }: ConnectedAppsProps) {
  const [grants, setGrants] = useState(initialGrants);
  const [error, setError] = useState<string | null>(null);

  async function disconnect(grant: GrantView) {
    if (!window.confirm(`Disconnect ${grant.clientName}? It loses access immediately.`)) return;
    setError(null);
    try {
      await apiCall(`/api/grants/${grant.id}`, { method: "DELETE" });
      setGrants((current) => current.filter((item) => item.id !== grant.id));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Couldn't disconnect the app.");
    }
  }

  return (
    <section aria-labelledby="apps-heading" className="panel p-6">
      <h2 id="apps-heading" className="font-display text-2xl font-semibold uppercase tracking-wide">
        Connected apps
      </h2>
      <p className="mt-2 text-sm text-ink-soft">AI apps you approved with your wallet. Disconnecting revokes every token they hold.</p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-loss">
          {error}
        </p>
      )}
      <ul className="mt-5 divide-y divide-rule border-t border-rule">
        {grants.length === 0 && <li className="py-3 text-sm text-ink-soft">No apps connected yet.</li>}
        {grants.map((grant) => (
          <li key={grant.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{grant.clientName}</p>
              <p className="font-mono text-xs text-ink-soft">{grant.scopes.join(" ")}</p>
              <p className="font-mono text-xs text-ink-soft">
                Connected {formatDateTime(Date.parse(grant.createdAt))}
                {grant.lastUsedAt ? ` · last used ${formatDateTime(Date.parse(grant.lastUsedAt))}` : ""}
              </p>
            </div>
            <button type="button" onClick={() => disconnect(grant)} className="btn btn-ghost btn-sm">
              Disconnect
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
