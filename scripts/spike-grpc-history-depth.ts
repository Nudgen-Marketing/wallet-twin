/**
 * Spike: does Tatum's Sui gRPC gateway (LedgerService/ListTransactions) index address
 * history further back than its GraphQL gateway (~26 Jul 2026)?
 *   pnpm tsx scripts/spike-grpc-history-depth.ts
 * Reads TATUM_API_KEY from .env.local. Prints findings only; never prints the key.
 */
import { config } from "dotenv";
import { ChannelCredentials } from "@grpc/grpc-js";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";

config({ path: [".env.local", ".env"], quiet: true });

// Tatum speaks native gRPC (HTTP/2, application/grpc), not gRPC-web.
const GRPC_HOST = "sui-mainnet-grpc.gateway.tatum.io:443";
/** First checkpoint Tatum GraphQL serves for affectedAddress filters (verified 2026-10-24). */
const GRAPHQL_FIRST_CHECKPOINT = 303_236_578n;

function client(): SuiGrpcClient {
  const apiKey = process.env.TATUM_API_KEY;
  if (!apiKey) throw new Error("TATUM_API_KEY is not set in .env.local");
  const transport = new GrpcTransport({
    host: GRPC_HOST,
    channelCredentials: ChannelCredentials.createSsl(),
    meta: { "x-api-key": apiKey },
  });
  return new SuiGrpcClient({ network: "mainnet", transport });
}

interface Found {
  digest: string | undefined;
  checkpoint: bigint | undefined;
  sender: string | undefined;
}

async function list(
  sui: SuiGrpcClient,
  request: Parameters<SuiGrpcClient["ledgerService"]["listTransactions"]>[0],
): Promise<{ found: Found[]; end: string }> {
  const call = sui.ledgerService.listTransactions(request);
  const found: Found[] = [];
  let end = "stream closed without end frame";
  for await (const frame of call.responses) {
    if (frame.transaction) {
      found.push({
        digest: frame.transaction.digest,
        checkpoint: frame.transaction.checkpoint,
        sender: frame.transaction.transaction?.sender,
      });
    }
    if (frame.end !== undefined) end = `end reason ${String(frame.end.reason)}`;
  }
  return { found, end };
}

async function main(): Promise<void> {
  const sui = client();

  // 1. Is there any data before the GraphQL window at all?
  const old = await list(sui, {
    readMask: { paths: ["digest", "checkpoint", "transaction.sender"] },
    startCheckpoint: 250_000_000n,
    endCheckpoint: 250_000_050n,
    options: { limit: 200 },
  });
  process.stdout.write(`unfiltered @ checkpoint 250M: ${old.found.length} tx (${old.end})\n`);
  // Skip 0x0 (system transactions touch it constantly); we need a real user.
  const SYSTEM = `0x${"0".repeat(64)}`;
  const oldSender = old.found.find((tx) => tx.sender && tx.sender !== SYSTEM)?.sender;
  if (!oldSender) {
    process.stdout.write("No pre-window transactions returned; gRPC is no deeper than GraphQL.\n");
    return;
  }

  // 2. Can we filter that old period by an address that was active in it?
  const byAddress = await list(sui, {
    readMask: { paths: ["digest", "checkpoint"] },
    endCheckpoint: GRAPHQL_FIRST_CHECKPOINT,
    filter: {
      terms: [
        {
          literals: [
            { negated: false, predicate: { oneofKind: "affectedAddress", affectedAddress: { address: oldSender } } },
          ],
        },
      ],
    },
    options: { limit: 5 },
  });
  const checkpoints = byAddress.found.map((tx) => tx.checkpoint?.toString()).join(", ");
  process.stdout.write(
    `affectedAddress=${oldSender} before checkpoint ${GRAPHQL_FIRST_CHECKPOINT}: ` +
      `${byAddress.found.length} tx [${checkpoints}] (${byAddress.end})\n`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  process.stderr.write(`spike failed — ${message}\n`);
  process.exit(1);
});
