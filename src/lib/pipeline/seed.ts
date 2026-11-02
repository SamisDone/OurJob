import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/profile/store";
import { normalizeCompanyName } from "./dedupe";

/** data/companies.seed.json: companies whose board was checked by hand or by a real request. */
export const seedCompanySchema = z.object({
  name: z.string().min(1),
  website: z.string().url(),
  ats: z.enum(["greenhouse", "lever", "ashby"]),
  slug: z.string().min(1),
});
export type SeedCompany = z.infer<typeof seedCompanySchema>;

export function loadSeed(path = "data/companies.seed.json"): SeedCompany[] {
  return z.array(seedCompanySchema).parse(JSON.parse(readFileSync(path, "utf8")));
}

export function loadWellKnown(path = "data/well-known-companies.json"): Set<string> {
  return new Set(
    z
      .array(z.string())
      .parse(JSON.parse(readFileSync(path, "utf8")))
      .map(normalizeCompanyName),
  );
}

/** Adds seed companies that are missing and keeps their board and well-known flag current. Muted or paused stay so. */
export async function upsertSeed(db: Db, seed: SeedCompany[], wellKnown: Set<string>): Promise<number> {
  let added = 0;
  for (const c of seed) {
    const normalizedName = normalizeCompanyName(c.name);
    const isWellKnown = wellKnown.has(normalizedName);
    const [row] = await db
      .select({ id: schema.companies.id })
      .from(schema.companies)
      .where(eq(schema.companies.normalizedName, normalizedName));
    if (row) {
      await db
        .update(schema.companies)
        .set({ atsType: c.ats, atsSlug: c.slug, atsVerified: true, isWellKnown, website: c.website })
        .where(eq(schema.companies.id, row.id));
      continue;
    }
    await db
      .insert(schema.companies)
      .values({
        name: c.name,
        normalizedName,
        website: c.website,
        atsType: c.ats,
        atsSlug: c.slug,
        atsVerified: true,
        discoveredVia: "seed",
        isWellKnown,
      })
      .onConflictDoNothing();
    added++;
  }
  return added;
}
