# TODO: unverified assumptions & open questions

Everything here is something we have **not** confirmed against docs or a live call.
Resolve each item (or record the answer) before relying on it in a demo.

## Tatum (Sui)

- [ ] **History depth.** Tatum's Sui GraphQL `transactions(filter: { affectedAddress })` only
      reaches back to checkpoint 303225304 (≈ 26 Jul 2026, ~90 days), per the endpoint's
      `serviceConfig.availableRange`. *Step 2:* test whether Tatum gRPC
      `LedgerService/ListTransactions` goes further back with an API key.
- [ ] **Credit cost** of a GraphQL query / gRPC call on Tatum. The free plan is 3 req/s and
      100K lifetime credits; a standard RPC call costs 2 credits. GraphQL pricing is unknown.
- [ ] **Anonymous GraphQL.** Queries worked without a key during research. We send `x-api-key`
      whenever `TATUM_API_KEY` is set; the anonymous rate limit is unknown.
- [ ] **zkLogin signature verification through Tatum GraphQL.** Sign-in passes
      `tatumSuiClient()` to `isValidPersonalMessageSignature` so zkLogin wallets (e.g. Slush)
      can resolve JWKs. Only Ed25519 has been verified (unit tests). Test with a real zkLogin
      wallet.
- [ ] **Prices.** `GET /v4/data/rate/symbol/OHLCV?symbol=…&unix=…` lists SUI, USDC, WAL, CETUS,
      HAEDAL but not DEEP, NAVX, BLUE, NS, SCA. Confirm `symbol=SUI` resolves, and confirm the
      response shape before parsing.
- [ ] No Sui support in Tatum Data API v4, v4 notifications, or `@tatumio/tatum`. Copy trading
      therefore polls. Re-check before the deadline in case support lands.

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
