import type { AtsReport } from "@/lib/jobs/types";
import type { JobSpec, MasterProfile } from "@/lib/profile/schema";
import { matchKeyword, type CvSections } from "./match";

/**
 * The estimated ATS score (docs/ATS_SCORING.md section 3): deterministic,
 * explainable, and always labeled an estimate in the UI. The same function
 * scores the master CV and a tailored CV, so the two numbers compare.
 */

export type ScoreInput = {
  spec: JobSpec;
  sections: CvSections;
  /** The master profile: for years of experience, contact checks, and whether a missing keyword is in his profile. */
  profile: MasterProfile;
  /** Sections of the full master CV, to tell "in profile but not in this CV" from a true gap. */
  masterSections: CvSections;
  /** Estimated rendered pages. */
  pages: number;
  targetPages?: 1 | 2;
};

const SENIORITY_YEARS: Record<string, [number, number]> = {
  intern: [0, 1],
  junior: [0, 2],
  mid: [2, 5],
  senior: [5, 9],
  staff: [8, 40],
  lead: [7, 40],
};
const LEVELS = ["intern", "junior", "mid", "senior", "staff"];

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Years from the earliest role start to now (or the latest end). */
export function yearsOfExperience(p: MasterProfile, now = new Date()): number | null {
  const starts = p.experience.map((e) => e.start).filter((s) => /^\d{4}/.test(s));
  if (!starts.length) return null;
  const first = Math.min(...starts.map((s) => Number(s.slice(0, 4)) + (Number(s.slice(5, 7) || 1) - 1) / 12));
  const nowY = now.getUTCFullYear() + now.getUTCMonth() / 12;
  return Math.max(0, nowY - first);
}

function levelFor(years: number): string {
  if (years < 1) return "intern";
  if (years < 2) return "junior";
  if (years < 5) return "mid";
  if (years < 8) return "senior";
  return "staff";
}

const CORE_NOUNS = ["engineer", "developer", "programmer", "architect", "scientist", "analyst", "designer", "manager"];

export function scoreCv(input: ScoreInput, now = new Date()): AtsReport {
  const { spec, sections, profile } = input;
  const techTerms = profile.skills.flatMap((s) => [s.name, ...s.aliases]);
  const opts = { techTerms: [...techTerms, ...spec.keywords.map((k) => k.term)] };
  const keywords = spec.keywords.filter((k) => k.kind !== "title");

  const results = keywords.map((k) => ({ k, m: matchKeyword(k, sections, opts) }));
  const must = results.filter((r) => r.k.importance === "must");
  const nice = results.filter((r) => r.k.importance === "nice");
  const share = (xs: typeof results) => (xs.length ? xs.filter((r) => r.m.found).length / xs.length : 1);

  // No nice-to-haves: their 15 points move to must-have coverage.
  const mustMax = nice.length ? 45 : 60;
  const components: AtsReport["components"] = [
    {
      id: "must",
      label: "Required keywords",
      points: round1(share(must) * mustMax),
      max: mustMax,
      detail: `${must.filter((r) => r.m.found).length} of ${must.length} found`,
    },
  ];
  if (nice.length)
    components.push({
      id: "nice",
      label: "Nice-to-have keywords",
      points: round1(share(nice) * 15),
      max: 15,
      detail: `${nice.filter((r) => r.m.found).length} of ${nice.length} found`,
    });

  // Placement: found hard skills and tools that appear in experience or projects, not only in skills.
  const hard = results.filter((r) => r.m.found && (r.k.kind === "hard_skill" || r.k.kind === "tool"));
  const placed = hard.filter((r) => r.m.locations.some((l) => l === "experience" || l === "projects"));
  components.push({
    id: "placement",
    label: "Keywords in experience",
    points: round1(hard.length ? (placed.length / hard.length) * 10 : 10),
    max: 10,
    detail: hard.length
      ? `${placed.length} of ${hard.length} appear in experience or projects, not only in skills`
      : "No hard skills found to place",
  });

  // Title alignment.
  const head = [...(sections.headline ?? []), ...(sections.summary ?? [])].join(" ").toLowerCase();
  const title = spec.title
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .trim();
  const noun = CORE_NOUNS.find((n) => title.includes(n));
  const qualifier = title
    .split(/[\s,/-]+/)
    .find(
      (w) => w.length > 3 && !CORE_NOUNS.includes(w) && !["senior", "staff", "lead", "junior", "principal"].includes(w),
    );
  const exact = (sections.headline ?? []).some((h) => h.toLowerCase().includes(title));
  const near = noun && head.includes(noun) && (!qualifier || head.includes(qualifier));
  components.push({
    id: "title",
    label: "Title alignment",
    points: exact ? 10 : near ? 6 : 0,
    max: 10,
    detail: exact
      ? `The headline says "${spec.title}"`
      : near
        ? `${[qualifier, noun].filter(Boolean).join(" and ")} appear in the headline or summary`
        : `The headline and summary do not name the role`,
  });

  // Seniority and years.
  const years = yearsOfExperience(profile, now);
  let seniorityPoints = 2.5;
  let seniorityDetail = "The job does not say its level";
  if (spec.seniority && spec.seniority !== "unknown" && years !== null) {
    const mine = levelFor(years);
    const want = spec.seniority === "lead" ? "staff" : spec.seniority;
    const diff = Math.abs(LEVELS.indexOf(mine) - LEVELS.indexOf(want));
    const [lo] = SENIORITY_YEARS[spec.seniority] ?? [0, 0];
    seniorityPoints = diff === 0 || years >= lo ? 5 : diff === 1 ? 2 : 0;
    seniorityDetail = `${Math.floor(years)}+ years ${seniorityPoints === 5 ? "fits" : "is below"} a ${spec.seniority} role`;
  }
  components.push({
    id: "seniority",
    label: "Seniority and years",
    points: seniorityPoints,
    max: 5,
    detail: seniorityDetail,
  });

  // Parseability: each check an equal share of 15.
  const target = input.targetPages ?? 1;
  const checks: AtsReport["checks"] = [
    {
      id: "headings",
      label: "Standard section headings",
      pass: true,
    },
    {
      id: "contact",
      label: "Email and at least one link",
      pass: Boolean(profile.basics.email) && profile.basics.links.length > 0,
      fix: "Add your email and a LinkedIn or GitHub link to your profile.",
    },
    {
      id: "dates",
      label: "Dates on every role, in one format",
      pass: profile.experience.every((e) => /^\d{4}(-\d{2})?$/.test(e.start)),
      fix: "Give every role a start date.",
    },
    { id: "columns", label: "One column, no images or icons", pass: true },
    {
      id: "length",
      label: `Fits ${target === 1 ? "one page" : "two pages"}`,
      pass: input.pages <= target,
      fix: "Shorten bullets or trim the skills and tech lines.",
    },
    { id: "header", label: "No text in headers or footers", pass: true },
    { id: "text", label: "Text can be copied out of the PDF", pass: true },
  ];
  const passed = checks.filter((c) => c.pass).length;
  components.push({
    id: "parse",
    label: "Parseability",
    points: round1((passed / checks.length) * 15),
    max: 15,
    detail: `${passed} of ${checks.length} checks pass`,
  });

  const matched: AtsReport["matched"] = results
    .filter((r) => r.m.found)
    .map((r) => ({ term: r.k.term, importance: r.k.importance, locations: r.m.locations }));
  const missing: AtsReport["missing"] = results
    .filter((r) => !r.m.found)
    .map((r) => ({
      term: r.k.term,
      importance: r.k.importance,
      inProfile: matchKeyword(r.k, input.masterSections, opts).found,
    }));

  const score = Math.round(components.reduce((n, c) => n + c.points, 0));
  return { score, components, matched, missing, checks };
}
