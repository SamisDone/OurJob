/**
 * Applies pending migrations in ./drizzle.
 *
 *   pnpm db:migrate         local database, DATABASE_URL from .env.local
 *   pnpm db:migrate:prod    production (Neon), from .env.production.local only
 *
 * Production prefers DATABASE_URL_UNPOOLED: Neon's direct connection, which
 * migrations need (the pooled "-pooler" host runs in transaction mode).
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const prod = process.argv.includes("--prod");

// Production never reads .env.local, so it cannot migrate the wrong database by accident.
config({ path: prod ? [".env.production.local"] : [".env.local", ".env"], quiet: true });

const url = prod ? process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
  console.error(
    prod
      ? "Put DATABASE_URL_UNPOOLED (Neon's direct connection string) in .env.production.local. See README, Deploy."
      : "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
  process.exit(1);
}

const host = new URL(url).hostname;
if (prod) {
  if (host === "localhost" || host === "127.0.0.1") {
    console.error("db:migrate:prod points at a local database. Use pnpm db:migrate for that.");
    process.exit(1);
  }
  if (host.includes("-pooler")) {
    console.warn("This is Neon's pooled host. Migrations should use the direct one (no -pooler in the host).");
  }
}

async function main(databaseUrl: string) {
  console.log(`Migrating ${host}`);
  const sql = postgres(databaseUrl, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
    console.log("Migrations applied.");
  } finally {
    await sql.end();
  }
}

main(url).catch((err) => {
  console.error(err);
  process.exit(1);
});
