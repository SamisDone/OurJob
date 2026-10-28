import "server-only";
import { db } from "@/lib/db/client";
import { dbCacheStore, getLLMProvider } from "@/lib/llm";
import { buildProfile, suggestSearchPreferences } from "./build";
import { applyEdits, type EditOp } from "./edit";
import { searchPreferencesSchema, type SearchPreferences } from "./schema";
import * as store from "./store";
import type { Db } from "./store";

/** Server-side profile operations for route handlers and server components. */
const d = () => db as unknown as Db;

const SOURCE_LABEL: Record<string, string> = {
  cv_tex: "CV",
  cv_pdf: "CV",
  cv_docx: "CV",
  cv_md: "CV",
  linkedin_pdf: "LinkedIn",
  github: "GitHub",
  portfolio: "portfolio",
  notes: "notes",
};

export function sourceSummaries(rows: Awaited<ReturnType<typeof store.latestSources>>) {
  return rows.map((r) => ({
    kind: r.kind,
    filename: r.filename,
    chars: r.text?.length ?? 0,
    preview: (r.text ?? "").slice(0, 6000),
    meta: r.meta,
    addedAt: r.createdAt.toISOString(),
  }));
}

export async function getSources(userId: string) {
  return sourceSummaries(await store.latestSources(d(), userId));
}

export async function rebuildProfile(userId: string) {
  const sources = (await store.latestSources(d(), userId)).filter((s) => s.text);
  const { profile } = await buildProfile(
    sources.map((s) => ({ kind: s.kind, text: s.text! })),
    { provider: getLLMProvider(), cache: dbCacheStore },
  );
  const labels = [...new Set(sources.map((s) => SOURCE_LABEL[s.kind]))];
  const note = `Built from your ${labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : labels[0]}`;
  return store.saveProfileVersion(d(), userId, profile, { note });
}

export async function editProfile(userId: string, ops: EditOp[]) {
  const current = await store.getCurrentProfile(d(), userId);
  if (!current) throw new Error("There is no profile to edit yet.");
  const { profile, notes } = applyEdits(current.data, ops);
  return store.saveProfileVersion(d(), userId, profile, { note: notes.join("; ") });
}

/**
 * Saved preferences, or a first suggestion from P5 merged with defaults when
 * none are saved yet. `suggested` tells the UI to say so.
 */
export async function getOrSuggestPreferences(
  userId: string,
): Promise<{ data: SearchPreferences; suggested: boolean }> {
  const saved = await store.getPreferences(d(), userId);
  if (saved) return { data: saved, suggested: false };
  const current = await store.getCurrentProfile(d(), userId);
  if (!current) return { data: searchPreferencesSchema.parse({}), suggested: false };
  const s = await suggestSearchPreferences(current.data, { provider: getLLMProvider(), cache: dbCacheStore });
  return { data: searchPreferencesSchema.parse(s), suggested: true };
}

export { store };
export const profileDb = d;
