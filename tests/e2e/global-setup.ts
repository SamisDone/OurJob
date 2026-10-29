import { readFileSync } from "node:fs";
import postgres from "postgres";
import { p1OutputSchema } from "@/lib/llm/prompts/p1-profile";
import { normalizeProfile } from "@/lib/profile/normalize";
import { E2E_USER, SHELL_USERS } from "./helpers";

/**
 * Creates the fictional e2e people and clears their data, so every run
 * starts from a known state. Only rows for these test users are touched.
 * E2E_USER and SHELL_USERS.fresh start with no profile; SHELL_USERS.confirmed
 * gets the fictional Nadia Chowdhury profile, already confirmed.
 */
export default async function globalSetup() {
  const url = process.env.DATABASE_URL ?? "postgres://ourjob:ourjob@localhost:5433/ourjob";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    for (const u of [E2E_USER, SHELL_USERS.fresh, SHELL_USERS.confirmed]) {
      await sql`delete from users where email = ${u.email} and id <> ${u.id}`;
      await sql`insert into users (id, email, name) values (${u.id}, ${u.email}, ${u.name})
                on conflict (id) do update set email = excluded.email, name = excluded.name`;
      await sql`delete from profile_sources where user_id = ${u.id}`;
      await sql`delete from master_profiles where user_id = ${u.id}`;
      await sql`delete from search_preferences where user_id = ${u.id}`;
    }
    const raw = JSON.parse(readFileSync("tests/fixtures/llm/p1-profile/nadia-chowdhury.json", "utf8")).output;
    const profile = normalizeProfile(p1OutputSchema.parse(raw));
    await sql`insert into master_profiles (user_id, version, data, is_current, confirmed_at, note)
              values (${SHELL_USERS.confirmed.id}, 1, ${sql.json(profile)}, true, now(), 'Seeded for e2e')`;
  } finally {
    await sql.end();
  }
}
