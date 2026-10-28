"use client";

import { type FormEvent, useState } from "react";
import { CopyField } from "@/components/agents/CopyButton";
import { apiCall } from "@/lib/http/client";
import type { ApiKeyView } from "@/lib/mcp/auth/api-keys";
import { DEFAULT_SCOPES, MCP_SCOPES, type McpScope, SCOPE_INFO } from "@/lib/mcp/scopes";
import { formatDateTime } from "@/lib/twin/format";

interface ApiKeysPanelProps {
  initialKeys: ApiKeyView[];
}

const EXPIRY_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "7", label: "7 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
  { value: "never", label: "Never" },
] as const;

export function ApiKeysPanel({ initialKeys }: ApiKeysPanelProps) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<McpScope[]>([...DEFAULT_SCOPES]);
  const [expiry, setExpiry] = useState<string>("30");
  const [created, setCreated] = useState<{ key: string; name: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleScope(scope: McpScope) {
    setScopes((current) => (current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]));
  }

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      const result = await apiCall<{ key: string; apiKey: ApiKeyView }>("/api/keys", {
        method: "POST",
        body: JSON.stringify({ name, scopes, expiresInDays: expiry === "never" ? null : Number(expiry) }),
      });
      setKeys((current) => [result.apiKey, ...current]);
      setCreated({ key: result.key, name: result.apiKey.name });
      setName("");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Couldn't create the key.");
    } finally {
      setIsBusy(false);
    }
  }

  async function revoke(key: ApiKeyView) {
    if (!window.confirm(`Revoke "${key.name}"? Agents using it lose access immediately.`)) return;
    setError(null);
    try {
      await apiCall(`/api/keys/${key.id}`, { method: "DELETE" });
      setKeys((current) => current.filter((item) => item.id !== key.id));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Couldn't revoke the key.");
    }
  }

  return (
    <section aria-labelledby="keys-heading" className="panel p-6">
      <h2 id="keys-heading" className="font-display text-2xl font-semibold uppercase tracking-wide">
        API keys
      </h2>
      <p className="mt-2 text-sm text-ink-soft">For scripts and agents that can&apos;t do OAuth. Treat a key like a password.</p>

      {created && (
        <div role="status" className="mt-5 border border-signal/60 bg-signal/10 p-4">
          <CopyField
            label={`New key · ${created.name}`}
            value={created.key}
            hint="Copy it now. It is shown once and never again; we only keep a hash."
          />
          <button type="button" onClick={() => setCreated(null)} className="link-volt mt-3 text-sm">
            I saved it
          </button>
        </div>
      )}

      <form onSubmit={createKey} className="mt-5 space-y-4">
        <label className="block">
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink-soft">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={60}
            placeholder="e.g. Trading notebook"
            className="mt-1.5 block w-full border border-rule bg-paper-deep px-3 py-2 text-ink placeholder:text-ink-soft/60 focus:border-signal focus:outline-none"
          />
        </label>
        <fieldset>
          <legend className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink-soft">Permissions</legend>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {MCP_SCOPES.map((scope) => (
              <li key={scope}>
                <label className="flex gap-2 text-sm" title={SCOPE_INFO[scope].description}>
                  <input
                    type="checkbox"
                    checked={scopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                    className="mt-0.5 size-4 accent-signal"
                  />
                  {SCOPE_INFO[scope].label}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <label className="block">
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink-soft">Expires</span>
          <select
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
            className="mt-1.5 block border border-rule bg-paper-deep px-3 py-2 text-ink focus:border-signal focus:outline-none"
          >
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={isBusy || scopes.length === 0 || !name.trim()} className="btn btn-volt btn-sm">
          {isBusy ? "Creating…" : "Create key"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-loss">
          {error}
        </p>
      )}

      <ul className="mt-6 divide-y divide-rule border-t border-rule">
        {keys.length === 0 && <li className="py-3 text-sm text-ink-soft">No active keys.</li>}
        {keys.map((key) => (
          <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{key.name}</p>
              <p className="font-mono text-xs text-ink-soft">
                {key.displayPrefix}… · {key.scopes.join(" ")}
              </p>
              <p className="font-mono text-xs text-ink-soft">
                {key.lastUsedAt ? `Used ${formatDateTime(Date.parse(key.lastUsedAt))}` : "Never used"}
                {key.expiresAt ? ` · expires ${formatDateTime(Date.parse(key.expiresAt))}` : " · no expiry"}
              </p>
            </div>
            <button type="button" onClick={() => revoke(key)} className="btn btn-ghost btn-sm">
              Revoke
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
