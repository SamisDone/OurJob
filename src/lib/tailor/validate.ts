import synonymsJson from "../../../data/skill-synonyms.json";
import { findKeyword, matchKeyword } from "@/lib/ats/match";
import { tailoredSections } from "@/lib/ats/sections";
import type { MasterProfile, TailoredBullet, TailoredResume } from "@/lib/profile/schema";
import { skillFold } from "@/lib/profile/skills";
import type { GapKeyword, MatchedKeyword } from "./keywords";
import { extractNumbers, unsupportedReason } from "./numbers";

/**
 * The deterministic validator (docs/AI_PROMPTS.md). Golden rule 1 lives here:
 * whatever the model says, nothing reaches the CV unless code can trace it to
 * the master profile. What code can repair it repairs ("fixed"); what needs
 * rewording goes to the fix loop ("fix"); the rest is reported ("report").
 */

export type CheckId =
  | "ids"
  | "source"
  | "numbers"
  | "bold"
  | "tech"
  | "skills"
  | "gap"
  | "coverage"
  | "style"
  | "length"
  | "order"
  | "kept";

export type Issue = {
  check: CheckId;
  /** "summary", "headline", "experience:exp_1:0" (a bullet), "skills", "resume". */
  ref: string;
  message: string;
  action: "fixed" | "fix" | "report";
};

export type ValidateContext = {
  profile: MasterProfile;
  matched: MatchedKeyword[];
  gaps: GapKeyword[];
  pages: 1 | 2;
  /** The cleaned job post. When given, bullets that copy its claims are caught (check 2b). */
  jobText?: string;
};

const STOPWORDS = new Set(
  "a an and are as at be by for from has have in into is it its of on or our that the their this to was we were will with you your".split(
    " ",
  ),
);
const words = (s: string) =>
  s
    .toLowerCase()
    .match(/[a-z0-9+#.%]+/g)
    ?.map((w) => w.replace(/\.$/, "")) ?? [];

/**
 * Check 2b: runs of 5 words that a bullet shares with the job post and that
 * bring in a content word its sources never use. That is the job's claim
 * pasted into his CV ("Ingest data from APIs, SFTP drops..."), not his
 * experience reworded. Returns the first such phrase, or null.
 */
export function copiedJobPhrase(text: string, sources: string, jobText: string, n = 5): string | null {
  const job = words(jobText);
  const jobGrams = new Set(job.map((_, i) => job.slice(i, i + n).join(" ")).filter((g) => g.split(" ").length === n));
  const sourceWords = new Set(words(sources));
  const w = words(text);
  for (let i = 0; i + n <= w.length; i++) {
    const gram = w.slice(i, i + n);
    if (!jobGrams.has(gram.join(" "))) continue;
    if (gram.some((x) => !STOPWORDS.has(x) && x.length > 2 && !sourceWords.has(x))) return gram.join(" ");
  }
  return null;
}

export const BANNED_WORDS = [
  "spearheaded",
  "leveraged",
  "utilized",
  "synergy",
  "passionate",
  "rockstar",
  "ninja",
  "cutting-edge",
  "robust",
  "seamless",
  "dynamic",
  "results-driven",
  "go-getter",
  "delve",
  "tapestry",
];

const dictionary = Object.entries(synonymsJson as Record<string, string[] | string>).filter(
  (e): e is [string, string[]] => !e[0].startsWith("_") && Array.isArray(e[1]),
);

/** Every piece of profile text an id can stand for, so a bullet's numbers can be traced. */
function sourceIndex(p: MasterProfile): Map<string, string> {
  const m = new Map<string, string>();
  const bulletText = (b: MasterProfile["experience"][number]["bullets"][number]) =>
    [b.text, ...b.metrics.map((x) => `${x.hedge ? `${x.hedge} ` : ""}${x.value}`)].join("\n");
  if (p.basics.summary) m.set(p.basics.summary.id, p.basics.summary.text);
  for (const e of p.experience) {
    for (const b of e.bullets) m.set(b.id, bulletText(b));
    m.set(e.id, [e.title, ...e.bullets.map(bulletText), e.tech.join(", ")].join("\n"));
  }
  for (const pr of p.projects) {
    for (const b of pr.bullets) m.set(b.id, bulletText(b));
    m.set(pr.id, [pr.description, ...pr.bullets.map(bulletText), pr.tech.join(", ")].join("\n"));
  }
  for (const s of p.skills) m.set(s.id, s.name);
  for (const e of p.education) m.set(e.id, [e.degree, e.field, e.institution].filter(Boolean).join(", "));
  for (const c of p.certifications) m.set(c.id, [c.name, c.date].filter(Boolean).join(", "));
  for (const a of p.awards) m.set(a.id, a.text);
  return m;
}

/** Rough rendered height in lines of the one-page template (calibrated against templates/resume-sample.tex). */
export const LINES_PER_PAGE = 50;
const CHARS_PER_LINE = 118;
export function estimateLines(t: TailoredResume): number {
  const text = (s: string) => Math.max(1, Math.ceil(s.length / CHARS_PER_LINE));
  let lines = 4; // name, contact line, spacing
  lines += t.sections.length * 1.6; // headings and rules
  if (t.summary) lines += text(t.summary.text);
  lines += Math.ceil(t.skills.length / 2) + 0.5;
  for (const e of [...t.experience, ...t.projects]) {
    lines += 1.3 + e.bullets.reduce((n, b) => n + text(b.text) + 0.2, 0) + (e.tech.length ? 1 : 0);
  }
  lines += t.educationIds.length * 1.3 + t.certificationIds.length + t.awardIds.length;
  return Math.round(lines * 10) / 10;
}

// Built from the code point so the source itself holds no em dash (copy guard).
const emDash = new RegExp(String.raw`\s*${String.fromCharCode(0x2014)}\s*`, "g");

export function validateTailored(
  input: TailoredResume,
  ctx: ValidateContext,
): { resume: TailoredResume; issues: Issue[] } {
  const { profile: p } = ctx;
  const issues: Issue[] = [];
  const src = sourceIndex(p);
  const resume: TailoredResume = structuredClone(input);
  const techTerms = p.skills.flatMap((s) => [s.name, ...s.aliases]);
  const known = new Set(
    [...techTerms, ...p.experience.flatMap((e) => e.tech), ...p.projects.flatMap((pr) => pr.tech)].map(skillFold),
  );
  const allProfileText = [...src.values()].join("\n");
  // Skill names from the synonym map that the profile never mentions; a bullet naming one adds a skill.
  const notInProfile = dictionary
    .map(([canonical, aliases]) => ({ term: canonical, canonical, synonyms: aliases }))
    .filter((kw) => ![kw.term, ...kw.synonyms].some((n) => known.has(skillFold(n))))
    .filter((kw) => !ctx.gaps.some((g) => skillFold(g.canonical) === skillFold(kw.canonical)))
    .filter((kw) => !findKeyword(kw, allProfileText, false, { techTerms }));

  /* 7. Style, auto-fix part: em dashes become commas. */
  const unDash = (s: string, ref: string) => {
    if (!emDash.test(s)) return s;
    emDash.lastIndex = 0;
    issues.push({ check: "style", ref, message: "An em dash was replaced with a comma.", action: "fixed" });
    return s.replace(emDash, ", ");
  };
  resume.headline = unDash(resume.headline, "headline");
  if (resume.summary) resume.summary.text = unDash(resume.summary.text, "summary");

  /* 1. IDs exist, and 6 (order): roles stay in the profile's (reverse chronological) order. */
  const expIds = new Map(p.experience.map((e, i) => [e.id, i]));
  const projIds = new Set(p.projects.map((pr) => pr.id));
  const dropUnknown = <T>(xs: T[], id: (x: T) => string, has: (id: string) => boolean, what: string, ref: string) =>
    xs.filter((x) => {
      if (has(id(x))) return true;
      issues.push({
        check: "ids",
        ref,
        message: `Removed ${what} "${id(x)}": it is not in your profile.`,
        action: "fixed",
      });
      return false;
    });
  resume.experience = dropUnknown(
    resume.experience,
    (e) => e.experienceId,
    (id) => expIds.has(id),
    "a role",
    "resume",
  );
  resume.projects = dropUnknown(
    resume.projects,
    (e) => e.projectId,
    (id) => projIds.has(id),
    "a project",
    "resume",
  );
  resume.educationIds = dropUnknown(
    resume.educationIds,
    (x) => x,
    (id) => p.education.some((e) => e.id === id),
    "education",
    "resume",
  );
  resume.certificationIds = dropUnknown(
    resume.certificationIds,
    (x) => x,
    (id) => p.certifications.some((c) => c.id === id),
    "a certification",
    "resume",
  );
  resume.awardIds = dropUnknown(
    resume.awardIds,
    (x) => x,
    (id) => p.awards.some((a) => a.id === id),
    "an award",
    "resume",
  );
  const sorted = [...resume.experience].sort((a, b) => expIds.get(a.experienceId)! - expIds.get(b.experienceId)!);
  if (sorted.some((e, i) => e !== resume.experience[i])) {
    resume.experience = sorted;
    issues.push({
      check: "order",
      ref: "resume",
      message: "Roles were put back in reverse chronological order.",
      action: "fixed",
    });
  }
  const mostRecent = p.experience[0];
  if (mostRecent && !resume.experience.some((e) => e.experienceId === mostRecent.id)) {
    issues.push({
      check: "order",
      ref: "resume",
      message: `The most recent role (${mostRecent.title}, ${mostRecent.company}) is missing. Add it with its experienceId "${mostRecent.id}".`,
      action: "fix",
    });
  }

  /* 4. Skills: every item maps to a profile skill, under the profile's name. */
  const skillById = new Map(p.skills.map((s) => [s.id, s]));
  for (const group of resume.skills) {
    group.items = group.items.filter((item) => {
      const s = skillById.get(item.skillId);
      if (!s) {
        issues.push({
          check: "skills",
          ref: "skills",
          message: `Removed "${item.name}": it is not a skill in your profile.`,
          action: "fixed",
        });
        return false;
      }
      if (![s.name, ...s.aliases].some((n) => skillFold(n) === skillFold(item.name))) item.name = s.name;
      return true;
    });
  }
  resume.skills = resume.skills.filter((g) => g.items.length);

  /* 5. Gap leaks in skills, tech and the headline are removed in code. */
  const leaks = (text: string, inSkills = false) =>
    ctx.gaps.filter((g) => findKeyword(g, text, inSkills, { techTerms })).map((g) => g.term);
  for (const group of resume.skills) {
    group.items = group.items.filter((item) => {
      const leak = leaks(item.name, true)[0];
      if (leak)
        issues.push({
          check: "gap",
          ref: "skills",
          message: `Removed "${item.name}" (${leak} is not in your profile).`,
          action: "fixed",
        });
      return !leak;
    });
  }
  resume.skills = resume.skills.filter((g) => g.items.length);
  const headlineLeak = leaks(resume.headline)[0];
  if (headlineLeak || !resume.headline.trim()) {
    const fallback = p.basics.headline ?? p.experience[0]?.title ?? "";
    issues.push({
      check: "gap",
      ref: "headline",
      message: headlineLeak
        ? `The headline named ${headlineLeak}; your own headline is used instead.`
        : "The headline was empty; your own headline is used.",
      action: "fixed",
    });
    resume.headline = fallback;
  }

  /* Bullets: 2 source support, 3 numbers, 3b bold and tech, 4 unknown skills, 5 gap leaks, 7 banned words. */
  const checkText = (text: string, sourceIds: string[], ref: string) => {
    const sources = sourceIds.map((id) => src.get(id) ?? "").join("\n");
    const copied = ctx.jobText ? copiedJobPhrase(text, sources, ctx.jobText) : null;
    if (copied) {
      issues.push({
        check: "source",
        ref,
        message: `Copies "${copied}" from the job post; its source items do not describe that. Describe only what the source says.`,
        action: "fix",
      });
    }
    const sourceNumbers = extractNumbers(sources);
    for (const n of extractNumbers(text)) {
      const reason = unsupportedReason(n, sourceNumbers);
      if (reason) issues.push({ check: "numbers", ref, message: reason, action: "fix" });
    }
    for (const leak of leaks(text)) {
      issues.push({ check: "gap", ref, message: `Mentions ${leak}, which is not in your profile.`, action: "fix" });
    }
    for (const kw of notInProfile) {
      const hit = findKeyword(kw, text, false, { techTerms });
      if (hit)
        issues.push({ check: "skills", ref, message: `Mentions ${hit}, which is not in your profile.`, action: "fix" });
    }
    for (const w of BANNED_WORDS) {
      if (new RegExp(`\\b${w}\\b`, "i").test(text)) {
        issues.push({
          check: "style",
          ref,
          message: `Uses "${w}", which is on the list of words to avoid.`,
          action: "fix",
        });
      }
    }
  };

  const checkBullet = (b: TailoredBullet, ref: string) => {
    b.text = unDash(b.text.trim(), ref);
    const unknown = b.sourceIds.filter((id) => !src.has(id));
    if (unknown.length) {
      b.sourceIds = b.sourceIds.filter((id) => src.has(id));
      issues.push({
        check: "ids",
        ref,
        message: `Unknown source ids removed: ${unknown.join(", ")}.`,
        action: "fixed",
      });
    }
    if (!b.sourceIds.length) {
      issues.push({
        check: "source",
        ref,
        message: "No source item in your profile supports this bullet.",
        action: "fix",
      });
    }
    const bad = b.boldPhrases.filter((ph) => !ph.trim() || !b.text.includes(ph));
    if (bad.length) {
      b.boldPhrases = b.boldPhrases.filter((ph) => !bad.includes(ph));
      issues.push({
        check: "bold",
        ref,
        message: `Bold phrases not in the text were removed: ${bad.join(", ")}.`,
        action: "fixed",
      });
    }
    checkText(b.text, b.sourceIds, ref);
  };

  for (const e of resume.experience) {
    const role = p.experience.find((x) => x.id === e.experienceId)!;
    e.bullets.forEach((b, i) => checkBullet(b, `experience:${e.experienceId}:${i}`));
    e.tech = cleanTech(e.tech, role.tech, `experience:${e.experienceId}`);
  }
  for (const pr of resume.projects) {
    const proj = p.projects.find((x) => x.id === pr.projectId)!;
    pr.bullets.forEach((b, i) => checkBullet(b, `projects:${pr.projectId}:${i}`));
    pr.tech = cleanTech(pr.tech, proj.tech, `projects:${pr.projectId}`);
  }
  if (resume.summary) {
    const ids = resume.summary.sourceIds.filter((id) => src.has(id));
    // The summary may always draw on the profile summary and role titles; years of experience usually live there.
    const base = [...new Set([...ids, ...(p.basics.summary ? [p.basics.summary.id] : [])])];
    checkText(resume.summary.text, base, "summary");
  }

  function cleanTech(tech: string[], allowed: string[], ref: string) {
    const ok = new Set(allowed.map(skillFold));
    return tech.filter((t) => {
      if (!ok.has(skillFold(t))) {
        issues.push({
          check: "tech",
          ref,
          message: `Removed "${t}" from the tech line: that role or project does not list it.`,
          action: "fixed",
        });
        return false;
      }
      const leak = leaks(t, true)[0];
      if (leak)
        issues.push({ check: "gap", ref, message: `Removed "${t}" from the tech line (${leak}).`, action: "fixed" });
      return !leak;
    });
  }

  /* 6. Matched coverage. */
  const sections = tailoredSections(resume, p);
  for (const m of ctx.matched) {
    if (!matchKeyword(m, sections, { techTerms }).found) {
      issues.push({
        check: "coverage",
        ref: "resume",
        message: `${m.term} is missing. Your profile shows it in ${m.proofIds.join(", ")}.`,
        action: "fix",
      });
    }
  }

  /* 9. Kept experience: every source bullet of every role is used, unless the notes say why it was left out. */
  for (const left of leftOutBullets(resume, p)) {
    // A reason counts only when it says something specific: "irrelevant to this job" does not.
    const note = resume.notes.find((n) => n.includes(left.bulletId) && reasonWords(n) >= 6);
    issues.push(
      note
        ? {
            check: "kept",
            ref: "resume",
            message: `Left out from ${left.company}: "${left.text}" (${note})`,
            action: "report",
          }
        : {
            check: "kept",
            ref: "resume",
            message: `Keep ${left.bulletId} from ${left.company} ("${left.text}"): add it as a bullet to experience:${left.roleId}. Leave it out only if it is clearly irrelevant to this job, with a note saying what it is about and what the job needs instead.`,
            action: "fix",
          },
    );
  }

  /* 8. Length. Shorten first: real experience is not dropped to fit (check 9). */
  const lines = estimateLines(resume);
  const budget = LINES_PER_PAGE * ctx.pages;
  if (lines > budget) {
    issues.push({
      check: "length",
      ref: "resume",
      message: `About ${Math.round(lines)} lines for a ${ctx.pages}-page CV that fits ${budget}. Shorten bullets, drop projects, or remove only role bullets that are clearly irrelevant to this job.`,
      action: "fix",
    });
  }

  return { resume, issues };
}

/** Words in a note after its "Left out <id>:" prefix. */
const reasonWords = (note: string) =>
  note
    .replace(/^[^:]*:/, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

export type LeftOutBullet = { roleId: string; company: string; bulletId: string; text: string };

/** Source bullets of the profile's roles that no tailored bullet uses, including those of a role left out entirely. */
export function leftOutBullets(resume: TailoredResume, p: MasterProfile): LeftOutBullet[] {
  const used = new Set(resume.experience.flatMap((e) => e.bullets.flatMap((b) => b.sourceIds)));
  return p.experience.flatMap((e) =>
    e.bullets
      .filter((b) => !used.has(b.id))
      .map((b) => ({ roleId: e.id, company: e.company, bulletId: b.id, text: b.text })),
  );
}

/** Bullet refs and the summary that still need the model, with their messages. */
export function failing(issues: Issue[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const i of issues.filter((x) => x.action === "fix")) m.set(i.ref, [...(m.get(i.ref) ?? []), i.message]);
  return m;
}
