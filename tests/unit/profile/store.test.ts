import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { p1OutputSchema } from "@/lib/llm/prompts/p1-profile";
import { applyEdits, conflictLabel, EditError, editOpSchema } from "@/lib/profile/edit";
import { normalizeProfile } from "@/lib/profile/normalize";
import { searchPreferencesSchema } from "@/lib/profile/schema";
import {
  confirmProfile,
  getCurrentProfile,
  getPreferences,
  latestSources,
  listVersions,
  restoreVersion,
  saveProfileVersion,
  savePreferences,
  saveSource,
  updateProfile,
  type Db,
} from "@/lib/profile/store";

const nadia = () =>
  normalizeProfile(
    p1OutputSchema.parse(JSON.parse(readFileSync("tests/fixtures/llm/p1-profile/nadia-chowdhury.json", "utf8")).output),
  );

let db: Db;
let userId: string;

beforeAll(async () => {
  const client = new PGlite();
  const pg = drizzle(client, { schema });
  await migrate(pg, { migrationsFolder: "./drizzle" });
  db = pg as unknown as Db;
  const [u] = await pg.insert(schema.users).values({ email: "nadia@example.com" }).returning();
  userId = u.id;
}, 30_000);

describe("profile versions (Postgres via PGlite, real migrations)", () => {
  it("saves every edit as a new version and keeps them all", async () => {
    const v1 = await saveProfileVersion(db, userId, nadia(), { note: "Built from your CV and LinkedIn" });
    const { profile } = applyEdits(v1.data, [{ op: "setBasics", fields: { headline: "Platform engineer" } }]);
    const v2 = await saveProfileVersion(db, userId, profile, { note: "Edited your details" });
    expect([v1.version, v2.version]).toEqual([1, 2]);
    const versions = await listVersions(db, userId);
    expect(versions.map((v) => [v.version, v.isCurrent, v.note])).toEqual([
      [2, true, "Edited your details"],
      [1, false, "Built from your CV and LinkedIn"],
    ]);
    expect((await getCurrentProfile(db, userId))?.data.basics.headline).toBe("Platform engineer");
  });

  it("restores an old version as a new current one", async () => {
    const restored = await restoreVersion(db, userId, 1);
    expect(restored.version).toBe(3);
    expect(restored.note).toBe("Restored version 1");
    expect((await getCurrentProfile(db, userId))?.data.basics.headline).toBe("Backend Engineer");
    expect((await listVersions(db, userId)).filter((v) => v.isCurrent)).toHaveLength(1);
  });

  it("keeps a profile confirmed across later edits", async () => {
    await confirmProfile(db, userId);
    const current = await getCurrentProfile(db, userId);
    const next = await saveProfileVersion(db, userId, current!.data, { note: "x" });
    expect(next.confirmedAt).not.toBeNull();
  });

  it("keeps both of two edits sent at the same time", async () => {
    const [u] = await (db as unknown as ReturnType<typeof drizzle<typeof schema>>)
      .insert(schema.users)
      .values({ email: "two-edits@example.com" })
      .returning();
    await saveProfileVersion(db, u.id, nadia(), { note: "Built" });
    const edit = (fields: Record<string, string>) =>
      updateProfile(db, u.id, (current) => {
        const { profile, notes } = applyEdits(current!.data, [{ op: "setBasics", fields }]);
        return { data: profile, note: notes.join("; ") };
      });
    await Promise.all([edit({ headline: "Platform engineer" }), edit({ location: "Dhaka, Bangladesh" })]);
    const current = await getCurrentProfile(db, u.id);
    expect(current?.data.basics).toMatchObject({ headline: "Platform engineer", location: "Dhaka, Bangladesh" });
    expect(current?.version).toBe(3);
  });

  it("runs simultaneous saves and a confirm one at a time", async () => {
    const [u] = await (db as unknown as ReturnType<typeof drizzle<typeof schema>>)
      .insert(schema.users)
      .values({ email: "busy@example.com" })
      .returning();
    await saveProfileVersion(db, u.id, nadia(), { note: "Built" });
    const saves = [1, 2, 3].map((n) => saveProfileVersion(db, u.id, nadia(), { note: `Edit ${n}` }));
    await Promise.all([...saves, confirmProfile(db, u.id)]);
    const versions = await listVersions(db, u.id);
    expect(versions.map((v) => v.version)).toEqual([4, 3, 2, 1]);
    expect(versions.filter((v) => v.isCurrent)).toHaveLength(1);
  });

  it("uses the newest source of each kind, any CV format counting as one", async () => {
    await saveSource(db, userId, { kind: "cv_pdf", text: "old pdf" });
    await new Promise((r) => setTimeout(r, 5));
    await saveSource(db, userId, { kind: "cv_md", text: "new md" });
    await saveSource(db, userId, { kind: "linkedin_pdf", text: "linkedin" });
    const latest = await latestSources(db, userId);
    expect(latest.map((s) => [s.kind, s.text]).sort()).toEqual([
      ["cv_md", "new md"],
      ["linkedin_pdf", "linkedin"],
    ]);
  });

  it("stores search preferences with defaults filled in", async () => {
    const saved = await savePreferences(
      db,
      userId,
      searchPreferencesSchema.parse({ targetTitles: ["Backend Engineer"] }),
    );
    expect(saved.preferLesserKnown).toBe(true);
    expect((await getPreferences(db, userId))?.targetTitles).toEqual(["Backend Engineer"]);
  });
});

describe("profile edits", () => {
  it("resolves a conflict by picking one of the listed values", () => {
    const p = nadia();
    expect(conflictLabel(p, "experience.exp_2.end")).toBe("Taka Pay");
    const { profile, notes } = applyEdits(p, [
      { op: "resolveConflict", field: "experience.exp_2.end", value: "2023-04" },
    ]);
    expect(profile.experience[1].end).toBe("2023-04");
    expect(profile.conflicts).toEqual([]);
    expect(notes).toEqual(["Resolved end for Taka Pay"]);
  });

  it("refuses a conflict value that was not offered", () => {
    expect(() =>
      applyEdits(nadia(), [{ op: "resolveConflict", field: "experience.exp_2.end", value: "2030-01" }]),
    ).toThrow(EditError);
  });

  it("edits a bullet and drops metrics and bold phrases no longer in it", () => {
    const { profile } = applyEdits(nadia(), [
      { op: "updateBullet", id: "b_1_2", text: "Moved nightly billing jobs to a Kafka event pipeline." },
    ]);
    const b = profile.experience[0].bullets[1];
    expect(b.metrics).toEqual([]);
    expect(b.boldPhrases).toEqual(["Kafka"]);
  });

  it("reorders bullets and refuses a stale order", () => {
    const { profile } = applyEdits(nadia(), [
      { op: "reorderBullets", itemId: "exp_1", order: ["b_1_3", "b_1_1", "b_1_2"] },
    ]);
    expect(profile.experience[0].bullets.map((b) => b.id)).toEqual(["b_1_3", "b_1_1", "b_1_2"]);
    expect(() => applyEdits(nadia(), [{ op: "reorderBullets", itemId: "exp_1", order: ["b_1_1"] }])).toThrow(EditError);
  });

  it("adds items and bullets with fresh ids marked as added by you", () => {
    const { profile } = applyEdits(nadia(), [
      {
        op: "addItem",
        section: "experience",
        fields: { company: "Example Co", title: "Engineer", start: "Jan 2019", end: "Jan 2020" },
      },
    ]);
    const added = profile.experience[2];
    expect(added.id).toMatch(/^exp_u[a-z0-9]+$/);
    expect(added.start).toBe("2019-01");
    expect(added.sources).toEqual(["user_added"]);
    const next = applyEdits(profile, [
      { op: "addBullet", itemId: added.id, text: "Built the billing export in Go." },
    ]).profile;
    expect(next.experience[2].bullets[0].sources).toEqual(["user_added"]);
    expect(next.skills.find((s) => s.name === "Go")?.evidence).toContain(next.experience[2].bullets[0].id);
  });

  it("rejects bad dates and empty required fields in plain words", () => {
    expect(() =>
      applyEdits(nadia(), [{ op: "updateItem", section: "experience", id: "exp_1", fields: { start: "soon" } }]),
    ).toThrow('"soon" is not a date. Use a form like Mar 2024, 2024 or Present.');
    expect(() =>
      applyEdits(nadia(), [{ op: "updateItem", section: "experience", id: "exp_1", fields: { title: "" } }]),
    ).toThrow("title cannot be empty.");
    expect(() =>
      applyEdits(nadia(), [{ op: "updateItem", section: "experience", id: "exp_1", fields: { id: "x" } }]),
    ).toThrow("id cannot be edited here.");
  });

  it("adds a skill once, with its canonical name", () => {
    const { profile } = applyEdits(nadia(), [{ op: "addSkill", name: "graphql", category: "tool" }]);
    expect(profile.skills.at(-1)).toMatchObject({ name: "GraphQL", sources: ["user_added"] });
    expect(() => applyEdits(profile, [{ op: "addSkill", name: "GQL", category: "tool" }])).toThrow(
      "GraphQL is already in your skills.",
    );
  });

  it("validates operations coming from the browser", () => {
    expect(editOpSchema.safeParse({ op: "deleteEverything" }).success).toBe(false);
    expect(editOpSchema.safeParse({ op: "updateBullet", id: "b_1_1", text: "" }).success).toBe(false);
  });
});
