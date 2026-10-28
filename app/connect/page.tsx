import { formatAddress } from "@mysten/sui/utils";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ApiKeysPanel } from "@/components/agents/ApiKeysPanel";
import { ClientSetup } from "@/components/agents/ClientSetup";
import { ConnectedApps } from "@/components/agents/ConnectedApps";
import { CopyField } from "@/components/agents/CopyButton";
import { getSession } from "@/lib/auth/session";
import type { ToolAccess } from "@/lib/mcp/define";
import { listApiKeys } from "@/lib/mcp/auth/api-keys";
import { listGrants } from "@/lib/mcp/auth/oauth";
import { pageOrigin } from "@/lib/mcp/auth/origin";
import { MCP_PATH, PUBLIC_MCP_PATH } from "@/lib/mcp/auth/urls";
import { MCP_SCOPES, SCOPE_INFO } from "@/lib/mcp/scopes";
import { ALL_TOOLS } from "@/lib/mcp/server";

export const metadata: Metadata = {
  title: "Agents · MCP",
  description: "Connect your WalletTwin to Claude, ChatGPT, Cursor or any MCP-compatible AI agent.",
};

const ACCESS_GROUPS: { access: ToolAccess; label: string; description: string }[] = [
  { access: "public", label: "Anyone", description: "No sign-in. Published twins and the leaderboard." },
  { access: "signed_in", label: "Any connection", description: "Which wallet the agent is acting for." },
  ...MCP_SCOPES.map((scope) => ({ access: scope, label: SCOPE_INFO[scope].label, description: SCOPE_INFO[scope].description })),
];

export default function ConnectPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
      <p className="kicker">Agents · MCP</p>
      <h1 className="mt-3 max-w-4xl fringe font-display text-5xl font-bold uppercase tracking-tight sm:text-6xl">
        Plug your twin into any AI agent
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-soft">
        WalletTwin speaks the Model Context Protocol. Connect Claude, ChatGPT, Cursor or your own agent, sign once with
        your wallet, and it can read your stats, recall your Walrus memories, talk to your twin, re-sync and paper-copy,
        only with the permissions you grant.
      </p>
      <Suspense fallback={<p className="mt-10 text-ink-soft">Loading connection details…</p>}>
        <Endpoints />
      </Suspense>
      <ToolCatalog />
      <Suspense fallback={null}>
        <YourAccess />
      </Suspense>
    </main>
  );
}

async function Endpoints() {
  const origin = await pageOrigin();
  const mcpUrl = `${origin}${MCP_PATH}`;
  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section aria-labelledby="endpoints-heading" className="panel panel-hot space-y-5 p-6">
        <h2 id="endpoints-heading" className="font-display text-2xl font-semibold uppercase tracking-wide">
          Server URLs
        </h2>
        <CopyField label="Your twin · OAuth or API key" value={mcpUrl} hint="Streamable HTTP. Agents sign in with your wallet the first time." />
        <CopyField
          label="Public twins · no sign-in"
          value={`${origin}${PUBLIC_MCP_PATH}`}
          hint="Leaderboard, published twins and their public chat. Rate-limited."
        />
      </section>
      <section aria-labelledby="setup-heading" className="panel p-6">
        <h2 id="setup-heading" className="font-display text-2xl font-semibold uppercase tracking-wide">
          Set up your client
        </h2>
        <div className="mt-4">
          <ClientSetup mcpUrl={mcpUrl} />
        </div>
      </section>
    </div>
  );
}

function ToolCatalog() {
  return (
    <section aria-labelledby="tools-heading" className="mt-14">
      <h2 id="tools-heading" className="font-display text-3xl font-bold uppercase tracking-tight">
        What an agent can do
      </h2>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Each permission unlocks a set of tools. Agents only ever see the tools you allowed. Nothing here can move funds or
        sign a transaction; copy trading is simulated.
      </p>
      <dl className="mt-6 divide-y divide-rule border-y border-rule">
        {ACCESS_GROUPS.map((group) => {
          const tools = ALL_TOOLS.filter((tool) => tool.access === group.access);
          if (tools.length === 0) return null;
          return (
            <div key={group.access} className="grid gap-3 py-4 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
              <dt>
                <span className="font-semibold">{group.label}</span>
                {group.access !== "public" && group.access !== "signed_in" && (
                  <span className="ml-2 font-mono text-xs text-signal">{group.access}</span>
                )}
                <span className="block text-sm text-ink-soft">{group.description}</span>
              </dt>
              <dd>
                <ul className="flex flex-wrap gap-2">
                  {tools.map((tool) => (
                    <li
                      key={tool.name}
                      title={tool.description}
                      className="border border-rule bg-paper-deep px-2.5 py-1 font-mono text-xs text-cyan"
                    >
                      {tool.name}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

async function YourAccess() {
  const session = await getSession();
  if (!session) {
    return (
      <p className="mt-12 text-lg text-ink-soft">
        Sign in (top right) to create API keys and manage the apps connected to your twin.
      </p>
    );
  }
  if (session.demo) {
    return (
      <p className="mt-12 max-w-2xl text-lg text-ink-soft">
        You&apos;re exploring the shared demo wallet {formatAddress(session.address)}. Agents can still connect to it
        through OAuth, but API keys and connected-app management need your own wallet.
      </p>
    );
  }
  const [keys, grants] = await Promise.all([listApiKeys(session.address), listGrants(session.address)]);
  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-2">
      <ConnectedApps initialGrants={grants} />
      <ApiKeysPanel initialKeys={keys} />
    </div>
  );
}
