# I gave my Sui wallet a memory. Now strangers can ask it how I trade.

*Building WalletTwin on Tatum and Walrus Memory for the Total Recall hackathon, and the four bugs I found while recording the demo.*

I can tell you roughly what's in my Sui wallet. I can't tell you why. Why I swapped into XAUM in October, why DEEP became my most traded token, why my busiest trading hour is around noon UTC on a Monday. The answers are all on-chain, spread across 283 transactions, and nobody reads 283 transactions. Including me.

So for the Tatum × Walrus "Total Recall" hackathon I built WalletTwin. It reads a wallet's full history, turns it into memories, and gives you a twin you can actually ask things. What's my worst habit? Which of my trades break the rule I just set? And if you choose to publish it, other people can ask it too, and copy the way you trade.

It's live at [twin.mermail.app](https://twin.mermail.app). The code is on [GitHub](https://github.com/Nudgen-Marketing/wallet-twin), and there's a [2½-minute demo on YouTube](https://youtu.be/Dkv4EXfo8rE).

[IMAGE:landing]

## What it does, in one minute

You connect a Sui wallet and sign one message. No gas, no transaction. That signature proves you own the address, and the sync starts:

1. Tatum pulls your history, every transaction back to January 2026.
2. Each one is classified (swap, transfer, NFT buy, mint, staking) and priced in USD at the hour it happened.
3. WalletTwin works out realized PnL, win rate and holding time, using FIFO cost basis.
4. The results go into Walrus Memory as trades, milestones, a style profile and a handful of habits, each one backed by data.

For my own wallet that came to 283 transactions, 63 swaps, $14,492 of priced volume, 12 closed positions, a 42% win rate and +$332 realized. Not a whale. Just someone who clicks a lot of buttons on Mondays, which is more or less what my twin told me later.

[IMAGE:sync]

## The moment it clicked

The first time it felt useful wasn't when I asked it a question. It was when I gave it a rule.

I told my twin: no single trade above $500 from now on. It didn't just reply "noted". It checked the rule against my history. My average trade is about $230, so the cap fits most of what I already do. But two trades would have broken it: $1,033 of XAUM swapped to USDC on October 13, and $751 of USDC into DEEP on September 3. Then it pointed out that DEEP is also my best token, up $366 over four trades, so the rule would have cost me something too.

A dashboard can't do that. A dashboard shows you numbers. This held my own history up against something I'd said a second earlier.

[IMAGE:chat]

## Reading the chain with Tatum

Sui has switched off JSON-RPC on its public mainnet nodes, so "just call the RPC" wasn't an option. Tatum gives you the two newer interfaces, and they behave differently enough that the choice mattered:

- **GraphQL** indexes address history for about 90 days. It's great for balances, coin metadata and checking zkLogin signatures at sign-in.
- **gRPC `ListTransactions`** goes much further back: to January 2026 on Tatum's nodes. That's the difference between a twin that knows your last quarter and one that knows your year.

So history comes over gRPC, with GraphQL as the fallback. Prices come from Tatum's Data API OHLCV endpoint: the USD price of that token at that hour. Every call costs credits, so prices are cached per token per hour, and I only price coins I've verified on-chain. Anything else shows as unknown. I'd rather show a gap in someone's PnL than a number I guessed.

The free plan allows 3 requests per second, shared between gRPC and HTTP, so every call goes through one rate gate with retries that respect `Retry-After`. I learned the credits lesson the hard way: while I was preparing the demo, the key ran dry (`402 credits_exhausted`) and the sync stopped dead.

## Giving it a memory with Walrus

Every twin lives in Walrus Memory, with one namespace per kind of memory:

```
twin:<address>:profile     who you are as a trader
twin:<address>:trade       one memory per trade
twin:<address>:insight     habits, backed by numbers
twin:<address>:milestone   records: biggest win, best token, ...
twin:<address>:chat        what you told your twin
```

I chose this layout for retrieval, but it turned out to be the privacy model too. A public twin only ever recalls `profile`, `insight` and `milestone`. Your individual trades, and anything you told it in a private chat, live in namespaces the public endpoint never queries. So a stranger can't talk their way into what the owner said in private. That memory is never in the context in the first place.

Chat uses MemWal's `withMemWal` middleware for the Vercel AI SDK. It recalls what you've told your twin before each answer and stores new facts afterwards. Trading memories I recall myself and pass to Claude as clearly delimited data, not as instructions.

[IMAGE:arch]

### How it keeps learning

This is the part the hackathon cared about most ("Total Recall" isn't subtle), and it's the part I'm happiest with:

- Each re-sync asks Tatum only for transactions after the last checkpoint, and writes trade memories for the new ones.
- Milestones are written only when a record actually changes. Beat your biggest win and a new milestone appears; the old one is never rewritten.
- A ledger keyed by transaction digest makes the whole pipeline idempotent. In the demo I re-sync with nothing new on-chain, and it writes exactly zero memories. That's on purpose.
- What you say in chat becomes memory, so the next conversation starts where the last one ended.

My wallet is at 80 memories on Walrus mainnet right now.

One practical note for anyone building on the relayer: its rate limits aren't documented. I hit 429s on bulk syncs and ended up writing a small weighted budget (a bulk write costs 10, a single write 5, a recall or status check 1, about 60 per minute per delegate key) that respects `retry_after_seconds`. Bulk status checks are also capped at 20 job IDs per call. Neither is hard to handle once you know. I'd just have liked to know before I started.

## Talk to someone else's twin, then copy them

Publishing is opt-in. Publish, and your twin gets a public page and a spot on the leaderboard. Anyone can chat with it: "How would you describe your trading style?" "What's your best trade ever?" It answers in the first person, from the public namespaces only.

[IMAGE:public]

If you like what you hear, you can copy it. Following a twin gives you a $1,000 paper portfolio. When the leader swaps on Sui, your portfolio mirrors the same share of their position at that moment's price. The leaderboard ranks twins by what copying them would have returned, then by win rate and realized PnL. My twin is at the top right now, at +7.9%.

[IMAGE:leaderboard]

This is the part I actually want to exist for real. If people copy your trades, you should get paid for it. WalletTwin's model is a 0.5% fee on copied volume, with half going to the trader being copied and half to the platform. Copy $100,000 of volume behind someone and they earn $250. In this build it's all paper: no real trades, no real funds, and the fee is simulated. Settling it for real, probably with agent payments on Sui, is the first thing on my list after the hackathon.

## Your twin, inside any AI agent

WalletTwin is also a remote MCP server with OAuth. Add `https://twin.mermail.app/api/mcp` to Claude, Claude Code, ChatGPT, Cursor or VS Code, sign in with your wallet, and your agent can ask your twin questions, read your stats or browse the leaderboard. It only gets the tools you allow. Public twins have their own endpoint that needs no sign-in.

[IMAGE:agents]

## Four bugs I found while recording the demo

I recorded the demo on my real wallet, against production, and it broke four times. It was the most useful hour of the whole project:

1. **Chat answers showed raw asterisks.** The model wrote markdown and the chat printed it as plain text. Small, but it made every answer look unfinished.
2. **Syncing my own wallet failed.** My history goes back further than the node's earliest checkpoint, and gRPC throws "below earliest available" in the middle of the stream instead of ending the page. Now that error ends the backwards walk cleanly.
3. **Every follow-up question failed.** The first answer worked; the second said the twin had "lost its train of thought". Earlier assistant turns carried signed reasoning blocks that couldn't be sent back. Earlier turns now go back as plain text.
4. **Paper copy failed with "couldn't read the chain tip".** When the range starts at genesis, GraphQL can return no timestamp for the first checkpoint, and the code took that to mean there was no data at all.

All four have tests now and are live. One I haven't fixed yet: in a long chat, the twin can second-guess a fact from its own earlier answer, because each turn only recalls memories for the latest question. It's on the list.

## What's next

- Real settlement for copy-trading fees, instead of a simulation.
- Twin-to-twin conversations: ask the top twin how it would trade this dip.
- Better DeFi classification (LP positions, lending), and deeper history as the indexes allow.

If you trade on Sui, try it with your own wallet. It takes one signature and about a minute. I'm curious what your twin says your worst habit is.

- App: [twin.mermail.app](https://twin.mermail.app)
- Code: [github.com/Nudgen-Marketing/wallet-twin](https://github.com/Nudgen-Marketing/wallet-twin)
- Demo: [youtu.be/Dkv4EXfo8rE](https://youtu.be/Dkv4EXfo8rE)

*Built with Tatum (Sui gRPC, GraphQL and the Data API) and Walrus Memory on mainnet. Not financial advice. Copy trading in WalletTwin is simulated.*
