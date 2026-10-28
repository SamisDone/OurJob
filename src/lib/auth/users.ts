import "server-only";
import { db, schema } from "@/lib/db/client";

export async function upsertUserOnSignIn(u: {
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<string> {
  const email = u.email.trim().toLowerCase();
  const [row] = await db
    .insert(schema.users)
    .values({ email, name: u.name ?? null, image: u.image ?? null })
    .onConflictDoUpdate({ target: schema.users.email, set: { name: u.name ?? null, image: u.image ?? null } })
    .returning({ id: schema.users.id });
  return row.id;
}
