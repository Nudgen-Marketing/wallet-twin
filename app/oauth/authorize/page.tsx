import { formatAddress } from "@mysten/sui/utils";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DemoLoginButton } from "@/components/demo/DemoLoginButton";
import { getSession, type Session } from "@/lib/auth/session";
import { demoWallets } from "@/lib/demo";
import { type AuthorizeRequest, sealConsent, validateAuthorizeRequest } from "@/lib/mcp/auth/oauth";
import { publicOrigin } from "@/lib/mcp/auth/urls";
import { SCOPE_INFO } from "@/lib/mcp/scopes";

export const metadata: Metadata = {
  title: "Connect an AI agent",
  robots: { index: false, follow: false },
};

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
  const [params, requestHeaders] = await Promise.all([searchParams, headers()]);
  const origin = publicOrigin(new Request(`http://${requestHeaders.get("host") ?? "localhost"}/`, { headers: requestHeaders }));
  const validation = await validateAuthorizeRequest(firstValues(params), origin);
  if (!validation.ok) {
    if (validation.redirectTo) redirect(validation.redirectTo);
    return <Problem message={validation.error} />;
  }

  const session = await getSession();
  if (!session) return <SignInFirst clientName={validation.request.clientName} />;
  return <ConsentForm request={validation.request} session={session} sealed={await sealConsent(validation.request)} />;
}

function Problem({ message }: { message: string }) {
  return (
    <>
      <h1 className="mt-3 fringe font-display text-4xl font-bold uppercase tracking-tight">Can&apos;t connect this app</h1>
      <p role="alert" className="mt-6 text-lg text-loss">
        {message}
      </p>
      <p className="mt-4 text-ink-soft">Go back to your AI app and start connecting WalletTwin again.</p>
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

function ConsentForm({ request, session, sealed }: { request: AuthorizeRequest; session: Session; sealed: string }) {
  return (
    <>
      <h1 className="mt-3 fringe font-display text-4xl font-bold uppercase tracking-tight">
        Let {request.clientName} use your twin?
      </h1>
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
