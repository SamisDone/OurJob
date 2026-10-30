import { findKeyword } from "@/lib/ats/match";
import { cachedGenerate, type CacheStore } from "@/lib/llm/cache";
import { P2_PROMPT_ID, P2_PROMPT_VERSION, p2OutputSchema, p2Prompt, type P2Output } from "@/lib/llm/prompts/p2-job";
import type { LLMProvider } from "@/lib/llm/types";
import type { JobSpec } from "@/lib/profile/schema";
import { canonicalSkill, knownAliases, skillFold } from "@/lib/profile/skills";
import { cleanJobText } from "./clean";
import { addStatedTerms } from "./terms";

const loose = (s: string) =>
  s.normalize("NFKC").toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

export type DroppedKeyword = { term: string; reason: string };

/**
 * Code checks after P2 (docs/AI_PROMPTS.md): every evidence quote must be in
 * the job description and so must the term itself; keywords are deduplicated
 * by canonical name (a "must" wins over a "nice") and synonyms are merged
 * with data/skill-synonyms.json.
 */
export function checkJobSpec(raw: P2Output, cleanedJd: string): { spec: JobSpec; dropped: DroppedKeyword[] } {
  const jd = loose(cleanedJd);
  const dropped: DroppedKeyword[] = [];
  const byCanonical = new Map<string, JobSpec["keywords"][number]>();

  for (const kw of raw.keywords) {
    const term = kw.term.trim();
    if (!term) continue;
    if (!kw.evidenceQuote.trim() || !jd.includes(loose(kw.evidenceQuote))) {
      dropped.push({ term, reason: "Its quote is not in the job description." });
      continue;
    }
    const inJd =
      kw.kind === "title" || loose(kw.evidenceQuote).includes(loose(term)) || findKeyword({ term }, cleanedJd, true);
    if (!inJd) {
      dropped.push({ term, reason: "The term is not in the job description." });
      continue;
    }
    const canonical = canonicalSkill(kw.canonical || term);
    const key = kw.kind === "title" ? `title:${skillFold(term)}` : skillFold(canonical);
    const synonyms = [
      ...new Set([...kw.synonyms, ...knownAliases(canonical)].map((s) => s.trim()).filter(Boolean)),
    ].filter((s) => skillFold(s) !== skillFold(term) && skillFold(s) !== skillFold(canonical));
    const prev = byCanonical.get(key);
    if (prev) {
      if (kw.importance === "must") prev.importance = "must";
      prev.synonyms = [...new Set([...prev.synonyms, ...synonyms])];
      continue;
    }
    byCanonical.set(key, { ...kw, term, canonical, synonyms });
  }

  const keywords = [...byCanonical.values()];
  if (!keywords.some((k) => k.kind === "title") && raw.title.trim()) {
    keywords.unshift({
      term: raw.title.trim(),
      canonical: raw.title.trim(),
      synonyms: [],
      importance: "must",
      kind: "title",
      evidenceQuote: raw.title.trim(),
    });
  }
  const softSkills = keywords.filter((k) => k.kind === "soft_skill");
  const kept = keywords.filter((k) => k.kind !== "soft_skill" || softSkills.indexOf(k) < 5);

  return {
    spec: {
      title: raw.title.trim(),
      company: raw.company?.trim() || undefined,
      seniority: raw.seniority,
      employmentType: raw.employmentType,
      location: raw.location,
      // Quoted fields stay only when they really are quotes; unknown is better than guessed.
      remoteScopeText: raw.remoteScopeText && jd.includes(loose(raw.remoteScopeText)) ? raw.remoteScopeText : undefined,
      salaryText: raw.salaryText && jd.includes(loose(raw.salaryText)) ? raw.salaryText : undefined,
      yearsExperience: raw.yearsExperience,
      responsibilities: raw.responsibilities.slice(0, 8),
      keywords: kept,
    },
    dropped,
  };
}

export async function parseJob(
  pasted: string,
  deps: { provider: LLMProvider; cache: CacheStore },
): Promise<{ cleaned: string; spec: JobSpec; dropped: DroppedKeyword[]; cached: boolean }> {
  const cleaned = cleanJobText(pasted);
  if (cleaned.length < 200) throw new Error("This looks too short for a job post. Paste the full description.");
  const { system, user } = p2Prompt(cleaned);
  const res = await cachedGenerate(deps.provider, deps.cache, P2_PROMPT_VERSION, {
    promptId: P2_PROMPT_ID,
    system,
    user,
    schema: p2OutputSchema,
    temperature: 0.1,
  });
  const { spec, dropped } = checkJobSpec(res.data, cleaned);
  // Terms the post states that the model left out, and must or nice from where each sits in the post.
  return { cleaned, spec: addStatedTerms(spec, cleaned), dropped, cached: res.cached };
}
