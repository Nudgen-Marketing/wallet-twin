/**
 * Records raw Tatum Sui GraphQL responses for offline tests.
 *   pnpm tsx scripts/record-tatum-fixtures.ts <address> [pageSize]
 * Reads TATUM_API_KEY from .env.local. Writes tests/fixtures/tatum/*.json.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { config } from "dotenv";
import { ADDRESS_HISTORY_QUERY, COIN_METADATA_QUERY, HISTORY_RANGE_QUERY } from "../lib/tatum/sui-graphql";

config({ path: [".env.local", ".env"], quiet: true });

const URL = "https://sui-mainnet.gateway.tatum.io/graphql";
const OUT_DIR = "tests/fixtures/tatum";

async function post(query: string, variables: Record<string, unknown>): Promise<unknown> {
  const apiKey = process.env.TATUM_API_KEY;
  const response = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(apiKey ? { "x-api-key": apiKey } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  await new Promise((resolve) => setTimeout(resolve, 400));
  return response.json();
}

async function main(): Promise<void> {
  const [address, pageSize = "20"] = process.argv.slice(2);
  if (!address) throw new Error("usage: record-tatum-fixtures.ts <address> [pageSize]");
  mkdirSync(OUT_DIR, { recursive: true });

  const history = await post(ADDRESS_HISTORY_QUERY, {
    last: Number(pageSize),
    before: null,
    filter: { affectedAddress: address },
  });
  writeFileSync(`${OUT_DIR}/history-page.json`, `${JSON.stringify(history, null, 2)}\n`);

  const range = await post(HISTORY_RANGE_QUERY, { filters: ["affectedAddress"] });
  writeFileSync(`${OUT_DIR}/history-range.json`, `${JSON.stringify(range, null, 2)}\n`);

  const coin = await post(COIN_METADATA_QUERY, { coinType: "0x2::sui::SUI" });
  writeFileSync(`${OUT_DIR}/coin-metadata-sui.json`, `${JSON.stringify(coin, null, 2)}\n`);

  process.stdout.write(`Recorded fixtures for ${address} into ${OUT_DIR}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
