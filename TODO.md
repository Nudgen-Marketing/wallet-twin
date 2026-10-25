# TODO: unverified assumptions & open questions

Everything here is something we have **not** confirmed against docs or a live call.
Resolve each item (or record the answer) before relying on it in a demo.

## Tatum (Sui)

Verified in step 2 (2026-10-24, live mainnet calls, `pnpm test:live`):

- [x] **History depth.** GraphQL's `affectedAddress` index starts at checkpoint 303,236,578
      (26 Jul 2026, ~90 days). **gRPC `LedgerService/ListTransactions` reaches checkpoint
      237,661,233 (23 Jan 2026, ~9 months)** for a real user address. That is the start of the
      node's index, so the gRPC source is the default (`TATUM_SUI_HISTORY_SOURCE=grpc`).
- [x] gRPC and GraphQL return identical data for the same transactions (digests, checkpoints,
      timestamps, gas, balance changes). See the live cross-check test.
- [x] Tatum gRPC is **native gRPC over HTTP/2** (`application/grpc`), not gRPC-web, so it uses
      `@protobuf-ts/grpc-transport` + `@grpc/grpc-js`. Server-only, and needs the API key.
- [x] Free plan: `x-ttm-plan: free;ratelimit=3;strategy=shared`, i.e. **3 req/s shared across
      HTTP and gRPC**. One rate gate in `lib/tatum` paces both. Anonymous GraphQL gets
      429 with `retry-after: 60` after a few calls.
- [x] GraphQL limits: 50 per page (transactions, balance changes, commands), query depth 20,
      300 query nodes.
- [x] **OHLCV prices** work: `GET https://api.tatum.io/v4/data/rate/symbol/OHLCV`, response
      `{symbol, openTime, closeTime, open, high, low, close, …}` with string prices. Priced
      coin types verified on-chain: SUI, USDC (native), WAL, CETUS, HAEDAL. **USDT and DEEP
      are rejected** (400, not in the symbol list), as are NAVX, BLUE, NS and SCA per the docs.
- [x] OHLCV returns the nearest candle even far outside its data range. We reject candles
      more than 2 intervals away and mark the value unknown.

Still open:

- [ ] **OHLCV costs 50 credits per call** (docs). Pricing pages disagree on the free plan:
      100K lifetime credits on the pricing page vs. 1M in the API spec. Prices must be cached
      per (symbol, hour) in SQLite (step 3), and dashboard usage watched.
- [ ] Credit cost of a GraphQL query and of a gRPC stream call is still unknown.
- [ ] OHLCV `close` is quoted in **USDT**, not USD (USDC closes ≈ 1.0013). Acceptable for
      estimates; label values as "≈ USD".
- [ ] Cloudflare in front of `api.tatum.io` blocks some clients (Python's default user agent
      got `error code: 1010`). Node `fetch` and curl work.
- [ ] **zkLogin signature verification through Tatum GraphQL.** Sign-in passes
      `tatumSuiClient()` to `isValidPersonalMessageSignature` so zkLogin wallets (e.g. Slush)
      can resolve JWKs. Only Ed25519 has been verified (unit tests). Test with a real zkLogin
      wallet.
- [ ] No Sui support in Tatum Data API v4, v4 notifications, or `@tatumio/tatum`. Copy trading
      therefore polls. Re-check before the deadline in case support lands.
- [ ] **Demo wallets** (step 9): most recently active addresses are bots with 50+ tx/day. Pick
      2–3 human-looking wallets with a few hundred swaps over the last months.

## Blocked on credentials (you)

- [ ] **`ANTHROPIC_WORKSPACE_ID` doesn't match the API key.** Verified 2026-10-25 with direct
      Messages API calls: without the header the key is rejected ("not scoped to a
      workspace"); with the configured `wrkspc_…` ID the API answers "Workspace … not found".
      The ID is well-formed but belongs to a different organisation than the key (or is
      mistyped). Fix: copy the workspace ID from the **same** Console organisation as the key,
      or create a key inside a workspace and drop `ANTHROPIC_WORKSPACE_ID`. Then run
      `pnpm check:services`. Until then, chat shows an error message, and the profile,
      insights and Wrapped line use deterministic templates. Run `pnpm seed` afterwards to
      regenerate the profile and insights with Claude.

## Walrus Memory (MemWal)

Verified live on mainnet 2026-10-25 (`https://relayer.memory.walrus.xyz`, relayer 0.1.0):

- [x] `pnpm seed` wrote **171 memories** for the two demo twins (159 + 12). All confirmed
      `done` via `getRememberBulkStatus` in about 3.5 minutes. Hackathon minimum is 10.
- [x] Semantic `recall` across the per-type namespaces works (e.g. "biggest loss on MAGMA"
      returns the worst-loss milestone first). `sort: "recent"` returns the newest profile.
      Public recall only touches profile/insight/milestone.
- [x] `withMemWal` end to end (with a stand-in model, on a dedicated test namespace):
      MemWal's `analyze()` extracted "User is saving for a house in Lisbon" and "risk limit is
      $500 per trade" from one message and stored them as `[chat]` memories; the next turn
      recalled and injected the fact into the model prompt.
- [x] **Relayer limits, from its own 429 response:** 60 weighted requests/min **per delegate
      key**. Bulk status takes **at most 20 job ids** per request. Both are handled in
      `lib/memory/walrus.ts` and `lib/memory/budget.ts` (weighted budget of 55/min, 429
      retry after `retry_after_seconds`, chunked status polls). The budget is per process,
      so avoid running `pnpm seed` while the dev server is busy.
- [ ] **`MEMWAL_AGENT_ID`.** The hackathon form asks for it. Is it the same as
      `MEMWAL_ACCOUNT_ID`, or something else?
- [ ] Chat latency: an owner chat turn makes ~6 Walrus recalls (4 namespaces + profile +
      `withMemWal`), about 3–6 s before the model starts. Consider caching recalled profile
      and insights per twin for a few minutes.
- [x] No update/delete in the SDK: profiles are regenerated as new entries and the newest is
      read; unpublishing gates access in SQLite. Documented in the README.

## Wallet / auth

- [x] **Swapped `@mysten/dapp-kit` 1.x for `@mysten/dapp-kit-react` 2.x** (+ `dapp-kit-core`),
      its maintained successor; 1.x is built on the JSON-RPC client Sui disabled on mainnet.
- [ ] Sign-in verified with the dev burner wallet (Ed25519) only. Test with Slush (zkLogin),
      whose verification goes through Tatum GraphQL.
- [ ] Rate limiting is in-memory (single instance). Use a shared store if deployed with more
      than one instance.

## App

- [ ] **Demo wallets are bots.** Scanning recent mainnet activity through Tatum mostly finds
      high-frequency bots (the "MAGMA scalper" makes hundreds of swaps). It gives rich,
      dollar-meaningful stats, but for a human story set `DEMO_WALLETS` to curated wallets
      (e.g. your own) and run `pnpm seed`.
- [ ] Live copy trading needs an active leader. The MAGMA bot pauses for hours at a time; the
      copy engine was verified on real Tatum data (fills and skips) and by tests.
- [ ] Wrapped card fonts are fetched from Google Fonts at runtime (memoized, with fallback).
      Consider bundling TTFs before deploying somewhere without outbound network.
- [ ] **Deployment:** SQLite needs a persistent disk; `after()` needs a platform with
      `waitUntil` (Vercel) or a long-running Node server. `NEXT_PUBLIC_APP_URL` must be the
      public origin for share links / OG images.
- [ ] Share pages with a wrong token render a no-index "not found" page with HTTP 200 (the
      check runs inside a streamed Suspense boundary). Nothing leaks, but it's a soft 404.

## Hackathon submission

- [x] Blog post draft: [docs/blog-post.md](docs/blog-post.md). Fill in the screenshots,
      memory count, demo URL and repo URL.
- [ ] Mainnet: ≥ 10 memories stored (blocked on MemWal credentials).
- [ ] Tatum dashboard account ID for the form.
- [ ] Public repo + deployed demo.
- [ ] Stretch: x402 / MPP agent payments on Sui. Research the docs before writing any code.
