import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { ourjobSql?: ReturnType<typeof postgres> };

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
  // prepare: false keeps it compatible with poolers (Neon's pooled URL, PgBouncer).
  return postgres(url, { max: 5, prepare: false });
}

// Reuse one connection pool across hot reloads in development.
const sqlClient = globalForDb.ourjobSql ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.ourjobSql = sqlClient;

export const db = drizzle(sqlClient, { schema, casing: undefined });
export { schema };
