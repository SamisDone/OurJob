import type { MasterProfile, SearchPreferences } from "@/lib/profile/schema";
import { mentions } from "@/lib/profile/skills";
import { normalizeTitle } from "./dedupe";

/**
 * The cheap, deterministic score before P4 (docs/ARCHITECTURE.md section 8,
 * step 9): how close the title is to his target titles, how many of his
 * skills the post names, and whether the level fits. 0 means "not his kind of
 * job" and the job is not stored at all.
 */

/** A title must name a software role; "Account Executive" and "Benefits Analyst" never reach scoring. */
const ROLE =
  /\b(?:engineer(?:ing)?|developer|programmer|software|swe|sde|full[- ]?stack|front[- ]?end|back[- ]?end|web|mobile|ios|android|devops|sre|machine learning|ml|ai|data scientist|architect)\b/i;
const NOT_ROLE =
  /\b(?:sales|account (?:executive|manager)|recruit(?:er|ing)|marketing|counsel|legal|accountant|payroll|customer success|support specialist|product (?:manager|owner|strategist|designer)|program manager|project manager|strategist|curriculum|enablement|partner|solutions (?:architect|engineer|consultant)|sales engineer)\b/i;
/** People-management titles count only when one of his target titles is one. */
const MANAGES = /\b(?:manager|director|head of|vp|vice president|chief)\b/i;
const LEVELS: [RegExp, "intern" | "junior" | "mid" | "senior" | "lead"][] = [
  [/\bintern(?:ship)?\b/i, "intern"],
  [/\b(?:junior|jr\.?|entry[- ]level|graduate|new grad|associate)\b/i, "junior"],
  [/\b(?:staff|principal|distinguished|head of|director|vp|vice president|manager)\b/i, "lead"],
  [/\b(?:senior|sr\.?|lead)\b/i, "senior"],
];
const STOP = new Set(["and", "the", "of", "for", "a", "an", "to", "in", "with", "i", "ii", "iii", "remote"]);
const words = (s: string) =>
  new Set(
    normalizeTitle(s)
      .split(" ")
      .filter((w) => w.length > 1 && !STOP.has(w)),
  );

export type PrefilterInput = { title: string; companyName: string; descriptionText: string; employmentType?: string };

export function levelOf(title: string): "intern" | "junior" | "mid" | "senior" | "lead" {
  return LEVELS.find(([re]) => re.test(title))?.[1] ?? "mid";
}

export function prefilterScore(
  job: PrefilterInput,
  profile: Pick<MasterProfile, "skills">,
  prefs: Pick<
    SearchPreferences,
    "targetTitles" | "stretchTitles" | "seniority" | "excludedCompanies" | "excludedKeywords" | "employmentTypes"
  >,
): number {
  if (!ROLE.test(job.title) || NOT_ROLE.test(job.title)) return 0;
  if (MANAGES.test(job.title) && ![...prefs.targetTitles, ...prefs.stretchTitles].some((t) => MANAGES.test(t)))
    return 0;
  const text = `${job.title}\n${job.descriptionText}`;
  if (prefs.excludedKeywords.some((k) => k.trim() && mentions(text, k.trim()))) return 0;
  const company = job.companyName.toLowerCase();
  if (prefs.excludedCompanies.some((c) => c.trim() && company === c.trim().toLowerCase())) return 0;
  if ((job.employmentType === "internship" || levelOf(job.title) === "intern") && !prefs.seniority.includes("intern"))
    return 0;
  const wanted = prefs.employmentTypes as string[];
  if (
    job.employmentType &&
    ["full_time", "contract", "part_time"].includes(job.employmentType) &&
    !wanted.includes(job.employmentType)
  )
    return 0;

  // Title: the best word overlap with a target title (stretch titles count 70%).
  const t = words(job.title);
  const overlap = (target: string) => {
    const w = words(target);
    if (!w.size || !t.size) return 0;
    return [...w].filter((x) => t.has(x)).length / w.size;
  };
  const title = Math.max(0.2, ...prefs.targetTitles.map(overlap), ...prefs.stretchTitles.map((s) => 0.7 * overlap(s)));

  // Skills: his languages, frameworks, databases and tools the post names, 8 or more is full marks.
  const tech = profile.skills.filter((s) =>
    ["language", "framework", "library", "database", "cloud", "tool"].includes(s.category),
  );
  const named = tech.filter((s) => [s.name, ...s.aliases].some((n) => n.length > 1 && mentions(text, n))).length;
  const skills = Math.min(1, named / 8);

  // Level: the title's level against the levels he picked; two steps away scores nothing.
  const order = ["intern", "junior", "mid", "senior", "lead"] as const;
  const level = levelOf(job.title);
  const picked = prefs.seniority.length ? prefs.seniority : (["junior", "mid", "senior"] as const);
  const distance = Math.min(...picked.map((p) => Math.abs(order.indexOf(p) - order.indexOf(level))));
  const levelFit = distance === 0 ? 1 : distance === 1 ? 0.4 : 0;

  return Math.round((0.5 * title + 0.35 * skills + 0.15 * levelFit) * 100) / 100;
}
