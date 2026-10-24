import "server-only";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClass?: typeof PrismaClient;
};

function createClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: env().DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Reuse one client across hot reloads in development, but rebuild it when
// `prisma generate` produced a new client (otherwise new models are undefined).
const reusable = globalForPrisma.prismaClass === PrismaClient ? globalForPrisma.prisma : undefined;
export const db = reusable ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaClass = PrismaClient;
}
