import "server-only";
import { z } from "zod";

const optionalSecret = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters (openssl rand -base64 48)"),
  NEXT_PUBLIC_SUI_NETWORK: z.enum(["mainnet", "testnet"]).default("mainnet"),
  TATUM_API_KEY: optionalSecret,
  // gRPC indexes ~9 months of address history; GraphQL ~90 days (verified 2026-10-24).
  TATUM_SUI_HISTORY_SOURCE: z.enum(["grpc", "graphql"]).default("grpc"),
  MEMWAL_PRIVATE_KEY: optionalSecret,
  MEMWAL_ACCOUNT_ID: optionalSecret,
  MEMWAL_SERVER_URL: z.url().default("https://relayer.memory.walrus.xyz"),
  ANTHROPIC_API_KEY: optionalSecret,
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-5-5"),
});

export type ServerEnv = z.infer<typeof envSchema>;

/** Keys that features need but the app can boot without (each step checks its own). */
export type FeatureSecret =
  | "TATUM_API_KEY"
  | "MEMWAL_PRIVATE_KEY"
  | "MEMWAL_ACCOUNT_ID"
  | "ANTHROPIC_API_KEY";

export class MissingConfigError extends Error {
  constructor(readonly key: FeatureSecret) {
    super(`${key} is not set. Add it to .env.local (see .env.example).`);
    this.name = "MissingConfigError";
  }
}

/** Parses an env record. Error messages name the variable, never its value. */
export function parseEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration — ${problems}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  cached ??= parseEnv(process.env);
  return cached;
}

export function requireSecret(key: FeatureSecret): string {
  const value = env()[key];
  if (!value) throw new MissingConfigError(key);
  return value;
}
