# WalletTwin: giving your Sui wallet a memory

*Draft for the Tatum × Walrus "Total Recall" submission. Replace the bracketed bits before
publishing.*

Every wallet tells a story: the 3 a.m. memecoin buy, the panic sell, the one trade you'll
never stop talking about. That story is all on-chain, but nobody can read it. WalletTwin
turns a Sui wallet's history into an **AI twin with a memory**. You can ask it why you did
things, get a "Wallet Wrapped" card, publish it to a leaderboard, or paper-copy someone
else's twin.

[screenshot: twin chat + stats panel]

## What it does

1. **Connect and sign** one gas-free message, which proves you own the wallet.
2. **Sync.** WalletTwin reads your history, classifies every transaction (swaps, transfers,
   NFT buys and mints, staking), prices each trade at the time it happened, and computes your
   realized PnL, win rate and holding times with FIFO cost basis.
3. **Your twin remembers.** Trades, milestones, a style profile and data-backed habits are
   written to Walrus Memory.
4. **Talk to it.** "What's my worst habit?" The twin answers in first person, grounded in what
   it recalls. Tell it something about yourself and it remembers that too.
5. **Share it.** A Wallet Wrapped card, and, if you opt in, a public twin that others can chat
   with and paper-copy with $1,000 of simulated money. A simulated 0.5% fee shows what a
   leader would earn from copy volume.

## How we used Tatum

Tatum is the only way WalletTwin reads the chain:

- **History over Tatum's Sui gRPC gateway.** Sui turned off JSON-RPC on mainnet this summer, so
  we went straight to the new interfaces. We compared both of Tatum's: GraphQL indexes address
  history for about 90 days, while gRPC `ListTransactions` goes back to January 2026. We
  default to gRPC and keep GraphQL as a fallback. A live test confirms both return identical
  balance changes for the same transactions.
- **GraphQL** for coin metadata, wallet balances (to size copy trades) and zkLogin signature
  checks at sign-in.
- **Data API OHLCV** for the USD price of each trade at the hour it happened. Each call costs
  credits, so prices are cached per token and hour, and we only price coins we verified
  on-chain. Anything else is shown as unknown, never guessed.
- One shared rate gate keeps HTTP and gRPC under the free plan's 3 requests per second.

## How we used Walrus Memory

Each twin lives in Walrus Memory under one namespace per memory type:
`twin:<address>:profile`, `:trade`, `:insight`, `:milestone` and `:chat`.

That layout gave us privacy for free: a public twin only ever queries the profile, insight and
milestone namespaces, so your private chat facts and individual trades can't leak into
someone else's conversation, even by prompt injection.

Chat uses MemWal's `withMemWal` middleware for the Vercel AI SDK. It recalls what you've told
your twin before each answer, and extracts new facts from your messages afterwards. We
recall the trading memories ourselves and hand them to Claude as clearly-delimited data.

## How it learns over time

- **Incremental syncs.** Each sync asks Tatum only for transactions after the last checkpoint,
  writes `[trade]` memories for the new ones, and regenerates the profile and insights.
- **New records become new memories.** Beat your biggest win and a new `[milestone]` appears;
  unchanged milestones are never rewritten.
- **Conversations stick.** What you tell your twin becomes `[chat]` memory and shapes future
  answers.
- **Nothing is stored twice.** A ledger keyed by transaction digest makes every re-sync
  idempotent: syncing with nothing new writes nothing.

[stat: N memories stored on Walrus mainnet for the demo twins]

## What we'd build next

- Settle the copy-trading fee for real with agent payments (x402 on Sui) instead of a simulation.
- Twin-to-twin conversations: "ask the top twin how it would trade this dip."
- Deeper history once indexes allow, plus richer DeFi classification (LP, lending).

**Try it:** [demo URL] · **Code:** [repo URL]

*Not financial advice. Copy trading in WalletTwin is simulated: no real trades, no real funds.*
