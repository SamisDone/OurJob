import "server-only";
import { db } from "@/lib/db/client";
import { dbCacheStore, getLLMProvider } from "@/lib/llm";
import { buildProfile, draftSearchPreferences, suggestSearchPreferences } from "./build";
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
  const order = ["CV", "LinkedIn", "GitHub", "portfolio", "notes"];
  const labels = [...new Set(sources.map((s) => SOURCE_LABEL[s.kind]))].sort(
    (a, b) => order.indexOf(a) - order.indexOf(b),
  );
  const note = `Built from your ${labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : labels[0]}`;
  return store.saveProfileVersion(d(), userId, profile, { note });
}

export async function editProfile(userId: string, ops: EditOp[]) {
  // Read, edit and save under the profile lock, so two quick edits never overwrite each other.
  return store.updateProfile(d(), userId, (current) => {
    if (!current) throw new Error("There is no profile to edit yet.");
    const { profile, notes } = applyEdits(current.data, ops);
    return { data: profile, note: notes.join("; ") };
  });
}

export type PreferencesResult = { data: SearchPreferences; suggested: boolean };

/**
 * Saved preferences, or, when none are saved yet, a draft built in code from
 * the profile. Never waits on the model: P5 can take 30 s, and the form must
 * show at once. `suggested` tells the UI to say the values are a suggestion.
 */
export async function getPreferencesOrDraft(userId: string): Promise<PreferencesResult> {
  const saved = await store.getPreferences(d(), userId);
  if (saved) return { data: saved, suggested: false };
  const current = await store.getCurrentProfile(d(), userId);
  if (!current) return { data: searchPreferencesSchema.parse({}), suggested: false };
  return { data: searchPreferencesSchema.parse(draftSearchPreferences(current.data)), suggested: true };
}

/** P5's suggestion on top of the draft, for the form to offer once it arrives. Null when preferences are saved. */
export async function suggestPreferences(userId: string): Promise<PreferencesResult | null> {
  if (await store.getPreferences(d(), userId)) return null;
  const current = await store.getCurrentProfile(d(), userId);
  if (!current) return null;
  const s = await suggestSearchPreferences(current.data, { provider: getLLMProvider(), cache: dbCacheStore });
  const draft = draftSearchPreferences(current.data);
  return {
    data: searchPreferencesSchema.parse({
      ...draft,
      ...s,
      targetTitles: s.targetTitles.length ? s.targetTitles : draft.targetTitles,
      coreSkills: s.coreSkills.length ? s.coreSkills : draft.coreSkills,
    }),
    suggested: true,
  };
}

export { store };
export const profileDb = d;
