import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { ApiError } from "@/lib/api";
import { buildCvDocument } from "@/lib/cv/build";
import { db, schema } from "@/lib/db/client";
import { renderLatex } from "@/lib/latex/render";
import { dbCacheStore, getLLMProvider } from "@/lib/llm";
import { DEFAULT_TAILOR_OPTIONS } from "@/lib/llm/prompts/p3-tailor";
import { getCurrentProfile } from "@/lib/profile/store";
import { getTailorModel } from "@/lib/settings/store";
import { tailorCv, type TailorStage } from "./pipeline";
import { atsReports } from "./report";

/**
 * Tailors his confirmed profile to one pasted job post and saves the result:
 * the job spec, the validated CV, its LaTeX, and the master and tailored
 * scores. Returns the new tailoring's id.
 */
export async function runTailoring(
  userId: string,
  pasted: string,
  onStage?: (s: TailorStage) => void,
): Promise<string> {
  const current = await getCurrentProfile(db, userId);
  if (!current?.confirmedAt) throw new ApiError(409, "Confirm your profile first. Tailoring only uses facts from it.");
  const profile = current.data;
  const tier = (await getTailorModel(db, userId)) === "thorough" ? "thorough" : "standard";
  const res = await tailorCv(pasted, profile, {
    provider: getLLMProvider(tier),
    jobProvider: getLLMProvider("standard"),
    cache: dbCacheStore,
    onStage,
  });
  const latex = renderLatex(buildCvDocument(profile, res.resume));
  const ats = atsReports(res.spec, profile, res.resume);
  const [row] = await db
    .insert(schema.tailorings)
    .values({
      userId,
      jdRaw: pasted,
      jdClean: res.cleaned,
      jobSpec: res.spec,
      tailored: res.resume,
      validatorReport: {
        issues: res.finalIssues,
        removed: res.removed,
        fixRounds: res.fixRounds,
        firstPassClean: !res.firstIssues.some((i) => i.action === "fix"),
        timings: res.timings,
      },
      latex,
      atsMaster: ats.master,
      atsTailored: ats.tailored,
      options: { ...DEFAULT_TAILOR_OPTIONS, model: tier },
      profileVersion: current.version,
    })
    .returning({ id: schema.tailorings.id });
  return row.id;
}

export async function getTailoring(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select()
    .from(schema.tailorings)
    .where(and(eq(schema.tailorings.id, id), eq(schema.tailorings.userId, userId)));
  return row ?? null;
}

/** His recent tailorings, newest first, for the history list. */
export async function listTailorings(userId: string, limit = 10) {
  const rows = await db
    .select({
      id: schema.tailorings.id,
      createdAt: schema.tailorings.createdAt,
      jobSpec: schema.tailorings.jobSpec,
      atsTailored: schema.tailorings.atsTailored,
    })
    .from(schema.tailorings)
    .where(eq(schema.tailorings.userId, userId))
    .orderBy(desc(schema.tailorings.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    title: r.jobSpec?.title ?? "Untitled job",
    company: r.jobSpec?.company ?? null,
    score: r.atsTailored?.score ?? null,
  }));
}

/** The profile as it was when a tailoring was made, so names and dates match the saved CV. */
export async function getProfileVersion(userId: string, version: number | null) {
  if (version === null) return (await getCurrentProfile(db, userId))?.data ?? null;
  const [row] = await db
    .select({ data: schema.masterProfiles.data })
    .from(schema.masterProfiles)
    .where(and(eq(schema.masterProfiles.userId, userId), eq(schema.masterProfiles.version, version)));
  return row?.data ?? null;
}
