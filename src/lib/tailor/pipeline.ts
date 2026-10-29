import { parseJob, type DroppedKeyword } from "@/lib/jd/parse";
import { cachedGenerate, type CacheStore } from "@/lib/llm/cache";
import {
  P3_FIX_PROMPT_ID,
  P3_FIX_PROMPT_VERSION,
  p3FixOutputSchema,
  p3FixPrompt,
  type P3FixOutput,
} from "@/lib/llm/prompts/p3-fix";
import {
  DEFAULT_TAILOR_OPTIONS,
  P3_PROMPT_ID,
  P3_PROMPT_VERSION,
  p3OutputSchema,
  p3Prompt,
  type TailorOptions,
} from "@/lib/llm/prompts/p3-tailor";
import type { LLMProvider } from "@/lib/llm/types";
import type { JobSpec, MasterProfile, TailoredBullet, TailoredResume } from "@/lib/profile/schema";
import { splitKeywords, type GapKeyword, type MatchedKeyword } from "./keywords";
import { failing, validateTailored, type Issue } from "./validate";

export const MAX_FIX_ROUNDS = 2;

export type RemovedItem = { ref: string; text: string; reasons: string[] };

export type TailorResult = {
  cleaned: string;
  spec: JobSpec;
  droppedKeywords: DroppedKeyword[];
  matched: MatchedKeyword[];
  gaps: GapKeyword[];
  resume: TailoredResume;
  /** Validator issues on the model's first answer, and on the final CV. */
  firstIssues: Issue[];
  finalIssues: Issue[];
  /** "Removed for accuracy": items still failing after the fix loop. */
  removed: RemovedItem[];
  fixRounds: number;
  timings: { parseMs: number; tailorMs: number; fixMs: number[]; totalMs: number };
};

export type TailorStage = "reading" | "tailoring" | "checking";

type Deps = {
  /** Writes the CV (P3 and fixes). This is the model he picked in Settings. */
  provider: LLMProvider;
  /** Reads the job post (P2). Defaults to `provider`; the app passes the standard model, so Thorough only rewrites. */
  jobProvider?: LLMProvider;
  cache: CacheStore;
  now?: () => number;
  onStage?: (s: TailorStage) => void;
};

/** Paste to tailored CV: clean, P2, matched and gaps, P3, validator, fix loop. */
export async function tailorCv(
  pasted: string,
  profile: MasterProfile,
  deps: Deps,
  opts: TailorOptions = DEFAULT_TAILOR_OPTIONS,
): Promise<TailorResult> {
  const now = deps.now ?? Date.now;
  const t0 = now();
  deps.onStage?.("reading");
  const { cleaned, spec, dropped } = await parseJob(pasted, {
    provider: deps.jobProvider ?? deps.provider,
    cache: deps.cache,
  });
  const t1 = now();

  const { matched, gaps } = splitKeywords(spec, profile);
  deps.onStage?.("tailoring");
  const { system, user } = p3Prompt(profile, spec, matched, gaps, opts);
  const first = await cachedGenerate(deps.provider, deps.cache, P3_PROMPT_VERSION, {
    promptId: P3_PROMPT_ID,
    system,
    user,
    schema: p3OutputSchema,
    temperature: 0.4,
  });
  const t2 = now();

  deps.onStage?.("checking");
  const ctx = { profile, matched, gaps, pages: opts.pages, jobText: cleaned };
  let { resume, issues } = validateTailored(first.data, ctx);
  const firstIssues = issues;
  const fixMs: number[] = [];
  let rounds = 0;
  while (rounds < MAX_FIX_ROUNDS && failing(issues).size) {
    const started = now();
    const problems = [...failing(issues)].map(([ref, errors]) => ({ ref, current: textAt(resume, ref), errors }));
    const fix = await cachedGenerate(deps.provider, deps.cache, P3_FIX_PROMPT_VERSION, {
      promptId: P3_FIX_PROMPT_ID,
      ...p3FixPrompt({ profile, spec, matched, gaps, opts, resume, problems }),
      schema: p3FixOutputSchema,
      temperature: 0.2,
    });
    // Changes run through the validator again, so nothing the fix adds goes unchecked.
    ({ resume, issues } = validateTailored(
      applyChanges(
        resume,
        fix.data,
        problems.map((p) => p.ref),
      ),
      ctx,
    ));
    fixMs.push(now() - started);
    rounds++;
  }

  const removed: RemovedItem[] = [];
  const stillFailing = failing(issues);
  if (stillFailing.size) {
    const drop = [...stillFailing].filter(
      ([ref]) => ref === "summary" || /^(experience|projects):[^:]+:\d+$/.test(ref),
    );
    for (const [ref, reasons] of drop) removed.push({ ref, text: textAt(resume, ref) ?? "", reasons });
    resume = removeRefs(
      resume,
      drop.map(([ref]) => ref),
    );
    ({ resume, issues } = validateTailored(resume, ctx));
  }

  return {
    cleaned,
    spec,
    droppedKeywords: dropped,
    matched,
    gaps,
    resume,
    firstIssues,
    finalIssues: issues,
    removed,
    fixRounds: rounds,
    timings: { parseMs: t1 - t0, tailorMs: t2 - t1, fixMs, totalMs: now() - t0 },
  };
}

function bulletAt(r: TailoredResume, ref: string): TailoredBullet | undefined {
  const [section, id, n] = ref.split(":");
  const list =
    section === "experience"
      ? r.experience.find((e) => e.experienceId === id)
      : r.projects.find((p) => p.projectId === id);
  return n === undefined ? undefined : list?.bullets[Number(n)];
}

export function textAt(r: TailoredResume, ref: string): string | undefined {
  return ref === "summary" ? r.summary?.text : bulletAt(r, ref)?.text;
}

/** Applies fix-loop changes. Only refs that were sent as problems (or add on their role) may change. */
export function applyChanges(r: TailoredResume, fix: P3FixOutput, allowed: string[]): TailoredResume {
  const out = structuredClone(r);
  const remove = new Set<string>();
  const allowedOwners = new Set([
    ...allowed.map((ref) => ref.split(":").slice(0, 2).join(":")),
    ...out.experience.map((e) => `experience:${e.experienceId}`),
    ...out.projects.map((p) => `projects:${p.projectId}`),
  ]);
  const coverageOrLength = allowed.includes("resume");
  for (const c of fix.changes) {
    if (c.ref === "summary") {
      if (!allowed.includes("summary")) continue;
      if (c.action === "remove") out.summary = undefined;
      else if (c.summary) out.summary = c.summary;
      continue;
    }
    const parts = c.ref.split(":");
    if (c.action === "add") {
      // Adding is for coverage, length-neutral gaps or the missing recent role, which arrive as "resume" problems.
      if (!coverageOrLength || !c.bullet || parts.length !== 2) continue;
      const [section, id] = parts;
      if (section === "experience") {
        let role = out.experience.find((e) => e.experienceId === id);
        if (!role) {
          role = { experienceId: id, bullets: [], tech: [] };
          out.experience.push(role);
        }
        role.bullets.push(c.bullet);
      } else if (section === "projects") {
        let proj = out.projects.find((p) => p.projectId === id);
        if (!proj) {
          proj = { projectId: id, bullets: [], tech: [] };
          out.projects.push(proj);
        }
        proj.bullets.push(c.bullet);
      }
      continue;
    }
    if (parts.length !== 3) continue;
    // A bullet may change if it was a problem, or for coverage and length, which concern the whole CV.
    if (!allowed.includes(c.ref) && !(coverageOrLength && allowedOwners.has(parts.slice(0, 2).join(":")))) continue;
    const b = bulletAt(out, c.ref);
    if (!b) continue;
    if (c.action === "remove") remove.add(c.ref);
    else if (c.bullet) Object.assign(b, c.bullet);
  }
  return removeRefs(out, [...remove]);
}

export function removeRefs(r: TailoredResume, refs: string[]): TailoredResume {
  const out = structuredClone(r);
  const set = new Set(refs);
  if (set.has("summary")) out.summary = undefined;
  for (const e of out.experience) e.bullets = e.bullets.filter((_, i) => !set.has(`experience:${e.experienceId}:${i}`));
  for (const p of out.projects) p.bullets = p.bullets.filter((_, i) => !set.has(`projects:${p.projectId}:${i}`));
  out.projects = out.projects.filter((p) => p.bullets.length);
  return out;
}
