import postgres from "postgres";
import { E2E_USER } from "./helpers";

/**
 * Creates the fictional e2e person and clears their data, so every run
 * starts from an empty profile. Only rows for this test user are touched.
 */
export default async function globalSetup() {
  const url = process.env.DATABASE_URL ?? "postgres://ourjob:ourjob@localhost:5433/ourjob";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`delete from users where email = ${E2E_USER.email} and id <> ${E2E_USER.id}`;
    await sql`insert into users (id, email, name) values (${E2E_USER.id}, ${E2E_USER.email}, ${E2E_USER.name})
              on conflict (id) do update set email = excluded.email, name = excluded.name`;
    await sql`delete from profile_sources where user_id = ${E2E_USER.id}`;
    await sql`delete from master_profiles where user_id = ${E2E_USER.id}`;
    await sql`delete from search_preferences where user_id = ${E2E_USER.id}`;
  } finally {
    await sql.end();
  }
}
