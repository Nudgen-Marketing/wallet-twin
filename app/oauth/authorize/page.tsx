import { formatAddress } from "@mysten/sui/utils";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { DemoLoginButton } from "@/components/demo/DemoLoginButton";
import { getSession, type Session } from "@/lib/auth/session";
import { demoWallets } from "@/lib/demo";
import { type AuthorizeRequest, sealConsent, validateAuthorizeRequest } from "@/lib/mcp/auth/oauth";
import { clientIp } from "@/lib/http/api";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { pageRequest } from "@/lib/mcp/auth/origin";
import { publicOrigin } from "@/lib/mcp/auth/urls";
import { SCOPE_INFO } from "@/lib/mcp/scopes";

export const metadata: Metadata = {
  title: "Connect an AI agent",
  robots: { index: false, follow: false },
};

// Each visit can fetch a client's metadata document, so unauthenticated visits are bounded per IP.
const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

export default function AuthorizePage(props: PageProps<"/oauth/authorize">) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
      <p className="kicker">Agent access · MCP</p>
      <Suspense fallback={<p className="mt-6 text-ink-soft">Checking the app that wants access…</p>}>
        <Consent searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

function firstValues(params: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
}

async function Consent({ searchParams }: { searchParams: PageProps<"/oauth/authorize">["searchParams"] }) {
  // The rate limiter reads the clock, so this must render per request, never in a prerender.
  await connection();
  const [params, request] = await Promise.all([searchParams, pageRequest()]);
  if (!limiter.take(clientIp(request))) return <Problem message="Too many connection attempts. Try again in a minute." returnTo={null} />;
  const validation = await validateAuthorizeRequest(firstValues(params), publicOrigin(request));
  if (!validation.ok) return <Problem message={validation.error} returnTo={validation.returnTo} />;

  const session = await getSession();
  if (!session) return <SignInFirst clientName={validation.request.clientName} />;
  return <ConsentForm request={validation.request} session={session} sealed={await sealConsent(validation.request)} />;
}

function Problem({ message, returnTo }: { message: string; returnTo: string | null }) {
  return (
    <>
      <h1 className="mt-3 fringe font-display text-4xl font-bold uppercase tracking-tight">Can&apos;t connect this app</h1>
      <p role="alert" className="mt-6 text-lg text-loss">
        {message}
      </p>
      <p className="mt-4 text-ink-soft">Go back to your AI app and start connecting WalletTwin again.</p>
      {returnTo && (
        <p className="mt-4 text-sm text-ink-soft">
          {/* A link, never an automatic redirect: see AuthorizeValidation. */}
          <a href={returnTo} rel="noreferrer" className="link-volt">
            Return to {hostOf(returnTo)}
          </a>
        </p>
      )}
    </>
  );
}

function SignInFirst({ clientName }: { clientName: string }) {
  return (
    <>
      <h1 className="mt-3 fringe font-display text-4xl font-bold uppercase tracking-tight">
        {clientName} wants to use your twin
      </h1>
      <p className="mt-6 text-lg text-ink-soft">
        First prove which wallet you are: connect it and sign in with the button at the top right. Signing is free and
        sends no transaction. You&apos;ll come back here to choose what {clientName} may do.
      </p>
      <section className="panel mt-8 p-6" aria-labelledby="demo-heading">
        <h2 id="demo-heading" className="font-display text-xl font-bold uppercase">
          No wallet handy?
        </h2>
        <p className="mt-2 text-sm text-ink-soft">Connect as a shared demo twin instead. Demo twins never save anything.</p>
        <ul className="mt-4 flex flex-wrap gap-3">
          {demoWallets().map((wallet) => (
            <li key={wallet.address}>
              <DemoLoginButton address={wallet.address} next={null} label={`Use ${wallet.label}`} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function hostOf(uri: string): string {
  try {
    const url = new URL(uri);
    return url.host || `${url.protocol}//`;
  } catch {
    return uri;
  }
}

/**
 * Names are self-declared, so the headline is the client's proven domain (CIMD) or an explicit
 * "unverified" (DCR); the claimed name only appears in quotes.
 */
function ClientIdentity({ request }: { request: AuthorizeRequest }) {
  if (request.clientSource === "cimd") {
    return (
      <p className="mt-4 text-ink-soft">
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-gain">Verified domain</span>{" "}
        {hostOf(request.clientId)} calls itself &ldquo;{request.clientName}&rdquo;.
      </p>
    );
  }
  return (
    <p className="mt-4 border border-signal/60 bg-signal/10 p-3 text-sm text-ink-soft">
      <span className="font-mono text-xs uppercase tracking-[0.16em] text-signal">Unverified app</span> It registered
      itself as &ldquo;{request.clientName}&rdquo;. Anyone can pick that name: only allow it if you just started
      connecting WalletTwin from that app and the address below is where you expect to go back to.
    </p>
  );
}

function ConsentForm({ request, session, sealed }: { request: AuthorizeRequest; session: Session; sealed: string }) {
  return (
    <>
      <h1 className="mt-3 fringe font-display text-4xl font-bold uppercase tracking-tight">
        {request.clientSource === "cimd" ? `Let ${hostOf(request.clientId)} use your twin?` : "Let an unverified app use your twin?"}
      </h1>
      <ClientIdentity request={request} />
      <dl className="mt-6 grid gap-x-6 gap-y-2 font-mono text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="text-ink-soft">Wallet</dt>
        <dd>
          {formatAddress(session.address)}
          {session.demo && <span className="ml-2 text-signal">shared demo · nothing is saved</span>}
        </dd>
        <dt className="text-ink-soft">Sends you back to</dt>
        <dd className="break-all text-cyan">{hostOf(request.redirectUri)}</dd>
        {request.clientUri && (
          <>
            <dt className="text-ink-soft">App website</dt>
            <dd className="break-all">{hostOf(request.clientUri)}</dd>
          </>
        )}
      </dl>

      <form method="post" action="/api/oauth/authorize" className="panel mt-8 p-6">
        <input type="hidden" name="request" value={sealed} />
        <fieldset>
          <legend className="font-display text-xl font-bold uppercase">It may</legend>
          <ul className="mt-4 space-y-3">
            {request.scopes.map((scope) => (
              <li key={scope}>
                <label className="flex gap-3">
                  <input type="checkbox" name="scope" value={scope} defaultChecked className="mt-1 size-4 accent-signal" />
                  <span>
                    <span className="font-semibold">{SCOPE_INFO[scope].label}</span>
                    <span className="block text-sm text-ink-soft">{SCOPE_INFO[scope].description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <p className="mt-6 text-sm text-ink-soft">
          It can never move funds or sign transactions: WalletTwin only reads your history. You can disconnect it any
          time on the Agents page.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" name="decision" value="approve" className="btn btn-volt">
            Allow
          </button>
          <button type="submit" name="decision" value="deny" className="btn btn-ghost">
            Deny
          </button>
        </div>
      </form>
    </>
  );
}
