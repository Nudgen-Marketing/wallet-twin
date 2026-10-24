# WalletTwin

Your Sui wallet's on-chain history, turned into an AI twin with memory. Built for the
Tatum × Walrus **Total Recall** hackathon.

- **Tatum** reads the chain. All server-side Sui reads go through Tatum's Sui gateway
  ([lib/tatum.ts](lib/tatum.ts)).
- **Walrus Memory** stores the twin: profile, trades, insights, milestones and chat facts
  (`lib/memory.ts`, coming in step 4).

> Work in progress. The full README (architecture diagram, demo script) lands in step 9.
> Open questions and unverified assumptions are listed in [TODO.md](TODO.md).

## Setup

Requires Node 24+ and pnpm (`corepack enable`).

```bash
pnpm install
cp .env.example .env.local   # then fill in SESSION_SECRET (openssl rand -base64 48) and keys
pnpm db:migrate              # creates prisma/dev.db
pnpm dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server. A throwaway "Unsafe Burner Wallet" is available for testing sign-in. |
| `pnpm test` | Vitest unit tests |
| `pnpm typecheck` / `pnpm lint` | TypeScript / ESLint |
| `pnpm db:migrate` | Apply Prisma migrations to SQLite |

Not financial advice. All copy trading is simulated.
