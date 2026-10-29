import { and, desc, eq, max } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/lib/db/schema";
import { masterProfileSchema, searchPreferencesSchema, type MasterProfile, type SearchPreferences } from "./schema";

/**
 * Profile versions, sources and search preferences in Postgres. Every save is
 * a new version and all versions are kept; restoring copies an old version
 * forward as the newest one. Functions take the database so tests can run
 * them on an in-process Postgres (PGlite).
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type ProfileVersion = {
  version: number;
  data: MasterProfile;
  isCurrent: boolean;
  confirmedAt: Date | null;
  createdAt: Date;
  note: string | null;
};

export async function getCurrentProfile(db: Db, userId: string): Promise<ProfileVersion | null> {
  const [row] = await db
    .select()
    .from(schema.masterProfiles)
    .where(and(eq(schema.masterProfiles.userId, userId), eq(schema.masterProfiles.isCurrent, true)));
  return row ? toVersion(row) : null;
}

export async function listVersions(db: Db, userId: string): Promise<Omit<ProfileVersion, "data">[]> {
  const rows = await db
    .select({
      version: schema.masterProfiles.version,
      isCurrent: schema.masterProfiles.isCurrent,
      confirmedAt: schema.masterProfiles.confirmedAt,
      createdAt: schema.masterProfiles.createdAt,
      note: schema.masterProfiles.note,
    })
    .from(schema.masterProfiles)
    .where(eq(schema.masterProfiles.userId, userId))
    .orderBy(desc(schema.masterProfiles.version));
  return rows;
}

function toVersion(row: typeof schema.masterProfiles.$inferSelect): ProfileVersion {
  return {
    version: row.version,
    data: masterProfileSchema.parse(row.data),
    isCurrent: row.isCurrent,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    note: row.note,
  };
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Profile writes for one person run one at a time. Without this, an edit
 * still saving while he confirms reads the unconfirmed version, writes a new
 * current version without the confirmation and quietly undoes it; two edits
 * at once also pick the same version number.
 */
async function lockProfile(tx: Tx, userId: string) {
  await tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, userId)).for("update");
}

/**
 * Reads the current version, lets `update` derive the next one from it, and
 * saves that as the newest version, all under the profile lock. Edits must go
 * through here: an edit computed from a version read outside the lock could
 * overwrite a change saved in between. A confirmed profile stays confirmed:
 * edits after onboarding do not send him back to it.
 */
export async function updateProfile(
  db: Db,
  userId: string,
  update: (current: ProfileVersion | null) => { data: MasterProfile; note?: string; confirmed?: boolean },
): Promise<ProfileVersion> {
  return db.transaction(async (tx) => {
    await lockProfile(tx, userId);
    const [{ latest }] = await tx
      .select({ latest: max(schema.masterProfiles.version) })
      .from(schema.masterProfiles)
      .where(eq(schema.masterProfiles.userId, userId));
    const [prev] = await tx
      .select()
      .from(schema.masterProfiles)
      .where(and(eq(schema.masterProfiles.userId, userId), eq(schema.masterProfiles.isCurrent, true)));
    const next = update(prev ? toVersion(prev) : null);
    const valid = masterProfileSchema.parse(next.data);
    await tx
      .update(schema.masterProfiles)
      .set({ isCurrent: false })
      .where(and(eq(schema.masterProfiles.userId, userId), eq(schema.masterProfiles.isCurrent, true)));
    const [row] = await tx
      .insert(schema.masterProfiles)
      .values({
        userId,
        version: (latest ?? 0) + 1,
        data: valid,
        isCurrent: true,
        note: next.note?.slice(0, 300) ?? null,
        confirmedAt: next.confirmed ? new Date() : (prev?.confirmedAt ?? null),
      })
      .returning();
    return toVersion(row);
  });
}

/** Saves `data` as the newest version and makes it current (a rebuild or a restore, not an edit). */
export async function saveProfileVersion(
  db: Db,
  userId: string,
  data: MasterProfile,
  opts: { note?: string; confirmed?: boolean } = {},
): Promise<ProfileVersion> {
  return updateProfile(db, userId, () => ({ data, ...opts }));
}

export async function restoreVersion(db: Db, userId: string, version: number): Promise<ProfileVersion> {
  const [old] = await db
    .select()
    .from(schema.masterProfiles)
    .where(and(eq(schema.masterProfiles.userId, userId), eq(schema.masterProfiles.version, version)));
  if (!old) throw new Error(`Version ${version} does not exist.`);
  return saveProfileVersion(db, userId, masterProfileSchema.parse(old.data), { note: `Restored version ${version}` });
}

export async function confirmProfile(db: Db, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await lockProfile(tx, userId);
    await tx
      .update(schema.masterProfiles)
      .set({ confirmedAt: new Date() })
      .where(and(eq(schema.masterProfiles.userId, userId), eq(schema.masterProfiles.isCurrent, true)));
  });
}

/* Sources --------------------------------------------------------------- */

export type SourceKind = (typeof schema.profileSourceKind.enumValues)[number];

export async function saveSource(
  db: Db,
  userId: string,
  src: { kind: SourceKind; text: string; filename?: string; bytes?: Uint8Array; meta?: Record<string, unknown> },
) {
  const [row] = await db
    .insert(schema.profileSources)
    .values({
      userId,
      kind: src.kind,
      extractedText: src.text,
      originalFilename: src.filename ?? null,
      fileBytes: src.bytes ? Buffer.from(src.bytes) : null,
      meta: src.meta ?? {},
      fetchedAt: new Date(),
    })
    .returning({
      id: schema.profileSources.id,
      kind: schema.profileSources.kind,
      createdAt: schema.profileSources.createdAt,
    });
  return row;
}

/**
 * The newest source of each kind. Older uploads are kept (re-import diffs
 * come later) but only the newest one feeds P1. A CV upload of any format
 * replaces the previous CV.
 */
export async function latestSources(db: Db, userId: string) {
  const rows = await db
    .select({
      id: schema.profileSources.id,
      kind: schema.profileSources.kind,
      text: schema.profileSources.extractedText,
      filename: schema.profileSources.originalFilename,
      meta: schema.profileSources.meta,
      createdAt: schema.profileSources.createdAt,
    })
    .from(schema.profileSources)
    .where(eq(schema.profileSources.userId, userId))
    .orderBy(desc(schema.profileSources.createdAt));
  const seen = new Set<string>();
  const out: typeof rows = [];
  for (const r of rows) {
    const group = r.kind.startsWith("cv_") ? "cv" : r.kind;
    if (seen.has(group)) continue;
    seen.add(group);
    out.push(r);
  }
  return out;
}

export async function removeSourceKind(db: Db, userId: string, kind: SourceKind) {
  await db
    .delete(schema.profileSources)
    .where(and(eq(schema.profileSources.userId, userId), eq(schema.profileSources.kind, kind)));
}

/* Search preferences ------------------------------------------------------ */

export async function getPreferences(db: Db, userId: string): Promise<SearchPreferences | null> {
  const [row] = await db.select().from(schema.searchPreferences).where(eq(schema.searchPreferences.userId, userId));
  return row ? searchPreferencesSchema.parse(row.data) : null;
}

export async function savePreferences(db: Db, userId: string, data: SearchPreferences): Promise<SearchPreferences> {
  const valid = searchPreferencesSchema.parse(data);
  await db
    .insert(schema.searchPreferences)
    .values({ userId, data: valid })
    .onConflictDoUpdate({ target: schema.searchPreferences.userId, set: { data: valid } });
  return valid;
}
