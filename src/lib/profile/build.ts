import { cachedGenerate, type CacheStore } from "@/lib/llm/cache";
import { P1_PROMPT_ID, P1_PROMPT_VERSION, p1OutputSchema, p1Prompt, type P1Source } from "@/lib/llm/prompts/p1-profile";
import { P5_PROMPT_ID, P5_PROMPT_VERSION, p5OutputSchema, p5Prompt } from "@/lib/llm/prompts/p5-search";
import type { LLMProvider } from "@/lib/llm/types";
import { dateSortKey } from "./dates";
import { normalizeProfile } from "./normalize";
import type { MasterProfile, SearchPreferences } from "./schema";
import { skillFold } from "./skills";

/** Upload kinds to the source tag P1 sees. */
export function sourceTagFor(kind: string): P1Source["kind"] {
  if (kind.startsWith("cv_")) return "cv";
  if (kind === "linkedin_pdf") return "linkedin";
  if (kind === "github" || kind === "portfolio" || kind === "notes") return kind;
  throw new Error(`Unknown source kind ${kind}`);
}

/** Runs P1 once over every source together and normalizes the answer. */
export async function buildProfile(
  sources: { kind: string; text: string }[],
  deps: { provider: LLMProvider; cache: CacheStore },
): Promise<{ profile: MasterProfile; cached: boolean }> {
  if (!sources.some((s) => s.kind.startsWith("cv_")))
    throw new Error("A CV is needed before the profile can be built.");
  const { system, user } = p1Prompt(sources.map((s) => ({ kind: sourceTagFor(s.kind), detail: s.kind, text: s.text })));
  const res = await cachedGenerate(deps.provider, deps.cache, P1_PROMPT_VERSION, {
    promptId: P1_PROMPT_ID,
    system,
    user,
    schema: p1OutputSchema,
    temperature: 0.1,
  });
  const profile = normalizeProfile(res.data);
  // Backstop for a fact models sometimes skip: an email written in the CV.
  // Copied from the source text, never made up.
  if (!profile.basics.email) {
    const cvText = sources.find((s) => s.kind.startsWith("cv_"))?.text ?? "";
    const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(cvText)?.[0];
    if (email) profile.basics.email = email;
  }
  return { profile, cached: res.cached };
}

/**
 * P5 suggestions as search preferences. Core skills the model names must be
 * skills in the profile; others are dropped. Seniority is a suggestion he
 * confirms in onboarding.
 */
/**
 * A first draft of search preferences, from the profile alone, in code: his
 * own titles (newest first), his best-evidenced skills, and a seniority from
 * his years of experience. Shown at once while P5 thinks.
 */
export function draftSearchPreferences(
  profile: MasterProfile,
  now = new Date(),
): Pick<SearchPreferences, "targetTitles" | "coreSkills" | "seniority"> {
  const roles = [...profile.experience].sort((a, b) => dateSortKey(b.start) - dateSortKey(a.start));
  const seen = new Set<string>();
  const targetTitles = roles
    .map((r) => r.title.trim())
    .filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()))
    .slice(0, 4);
  const coreSkills = [...profile.skills]
    .filter((s) => s.category !== "soft")
    .sort((a, b) => b.evidence.length - a.evidence.length)
    .slice(0, 10)
    .map((s) => s.name);
  const month = (v: string | undefined) => {
    if (v === "present") return now.getFullYear() * 12 + now.getMonth();
    const m = /^(\d{4})(?:-(\d{2}))?$/.exec(v ?? "");
    return m ? +m[1] * 12 + (m[2] ? +m[2] - 1 : 0) : null;
  };
  const starts = roles.map((r) => month(r.start)).filter((x): x is number => x !== null);
  const ends = roles.map((r) => month(r.end ?? "present")).filter((x): x is number => x !== null);
  const years = starts.length && ends.length ? (Math.max(...ends) - Math.min(...starts)) / 12 : 0;
  const seniority: SearchPreferences["seniority"] =
    years < 1 ? ["intern", "junior"] : years < 3 ? ["junior", "mid"] : years < 6 ? ["mid", "senior"] : ["senior"];
  return { targetTitles, coreSkills, seniority };
}

export async function suggestSearchPreferences(
  profile: MasterProfile,
  deps: { provider: LLMProvider; cache: CacheStore },
): Promise<Pick<SearchPreferences, "targetTitles" | "stretchTitles" | "coreSkills" | "seniority">> {
  const { system, user } = p5Prompt(profile);
  const { data } = await cachedGenerate(deps.provider, deps.cache, P5_PROMPT_VERSION, {
    promptId: P5_PROMPT_ID,
    system,
    user,
    schema: p5OutputSchema,
    temperature: 0.1,
  });
  const bySkill = new Map(profile.skills.map((s) => [skillFold(s.name), s.name]));
  const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
  return {
    targetTitles: uniq(data.targetTitles).slice(0, 6),
    stretchTitles: uniq(data.stretchTitles).slice(0, 4),
    coreSkills: uniq(data.coreSkills.map((s) => bySkill.get(skillFold(s)) ?? "").filter(Boolean)).slice(0, 10),
    seniority: uniq(data.seniority) as SearchPreferences["seniority"],
  };
}
