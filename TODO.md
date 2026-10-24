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

## Walrus Memory (MemWal)

- [ ] **Credentials.** A mainnet `MEMWAL_ACCOUNT_ID` plus a delegate key from
      https://memory.walrus.xyz. Can the dashboard also create testnet/staging accounts?
- [ ] **`MEMWAL_AGENT_ID`.** The hackathon form asks for it. Is it the same as
      `MEMWAL_ACCOUNT_ID`, or something else?
- [ ] **Hosted relayer limits.** Documented defaults are ~60 weighted req/min per user
      (`remember` = 5, bulk = 10, recall = 1); real values and launch caps are unknown.
- [ ] **Write latency** on the public relayer (docs say 20–90 s), and whether identical text
      deduplicates (Seal ciphertext may not be deterministic). We use our own
      `idempotencyKey` and a SQLite ledger regardless.
- [ ] **No update/delete in the SDK.** "Regenerating" the profile writes a new entry and
      reads the most recent one. Unpublishing gates access in SQLite; memories remain in the
      operator account. Document this in the README.
- [ ] Does `withMemWal` (AI SDK v4–v6) work with the pinned `ai@6` + `@ai-sdk/anthropic@3`
      combination? Verify in step 5.

## Wallet / auth

- [ ] **Swapped `@mysten/dapp-kit` 1.x for `@mysten/dapp-kit-react` 2.x** (+ `dapp-kit-core`),
      its maintained successor. 1.x is built on the JSON-RPC client, which Sui disabled on
      mainnet. The brief asked for "@mysten/dapp-kit"; this is the same kit's current package.
- [ ] The wallet UI uses the public Sui fullnode gRPC endpoint (no key) only for wallet
      plumbing; all data reads go server-side through Tatum. Confirm that no dApp Kit feature
      we use depends on that client for data.
- [ ] Rate limiting is in-memory (single instance). Swap to a shared store if deployed with
      more than one instance.

## Hackathon submission

- [ ] Blog post (required): what it does, how it uses Tatum and Walrus, how it "learned over time".
- [ ] Mainnet: ≥ 10 memories stored.
- [ ] Tatum dashboard account ID for the form.
- [ ] Stretch: x402 / MPP agent payments on Sui. Research the docs before writing any code.
