import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/profile/store";
import { getTailorModel, setTailorModel } from "@/lib/settings/store";

let db: Db;
let userId: string;

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "./drizzle" });
  db = pg as unknown as Db;
  const [u] = await pg.insert(schema.users).values({ email: "nadia@example.com" }).returning();
  userId = u.id;
}, 30_000);

describe("tailoring model setting (PGlite, real migrations)", () => {
  it("starts as standard and keeps what he picks", async () => {
    expect(await getTailorModel(db, userId)).toBe("standard");
    await setTailorModel(db, userId, "thorough");
    expect(await getTailorModel(db, userId)).toBe("thorough");
  });

  it("reads anything unexpected as standard", async () => {
    await db.update(schema.users).set({ tailorModel: "turbo" });
    expect(await getTailorModel(db, userId)).toBe("standard");
  });
});
