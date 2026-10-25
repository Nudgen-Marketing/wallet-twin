/**
 * Pre-flight check of external services with the configured keys (prints status only).
 *   pnpm check:services
 */
import { MemWal } from "@mysten-incubation/memwal";
import { generateText } from "ai";
import { languageModel } from "@/lib/ai";
import { walrusConfig } from "@/lib/memory";
import { getHistoryRange } from "@/lib/tatum";

async function check(name: string, run: () => Promise<string>): Promise<boolean> {
  try {
    process.stdout.write(`✓ ${name}: ${await run()}\n`);
    return true;
  } catch (error: unknown) {
    process.stdout.write(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}\n`);
    return false;
  }
}

async function main(): Promise<void> {
  const results = [
    await check("Tatum Sui GraphQL", async () => {
      const range = await getHistoryRange();
      return `chain tip checkpoint ${range?.lastCheckpoint ?? "unknown"}`;
    }),
    await check("Walrus Memory relayer", async () => {
      const config = walrusConfig();
      if (!config) throw new Error("MEMWAL_PRIVATE_KEY / MEMWAL_ACCOUNT_ID not set");
      const client = MemWal.create(config);
      const health = await client.health();
      const namespaces = await client.listNamespaces({ limit: 50 });
      return `${health.status} (relayer ${health.version}), ${JSON.stringify(namespaces).length > 2 ? "namespaces listed" : "no namespaces"} at ${config.serverUrl}`;
    }),
    await check("Anthropic", async () => {
      const { text } = await generateText({ model: languageModel(), prompt: "Reply with exactly: ok", maxOutputTokens: 5 });
      return `model replied "${text.trim()}"`;
    }),
  ];
  process.exitCode = results.every(Boolean) ? 0 : 1;
}

void main();
