import synonymsJson from "../../../data/skill-synonyms.json";
import { findKeyword, keywordForms, matchKeyword } from "@/lib/ats/match";
import { tailoredSections } from "@/lib/ats/sections";
import type { MasterProfile, TailoredBullet, TailoredResume } from "@/lib/profile/schema";
import { mentions, skillFold } from "@/lib/profile/skills";
import type { GapKeyword, MatchedKeyword } from "./keywords";
import { placementHints } from "@/lib/llm/prompts/p3-tailor";
import { addedDetails, droppedDetails, placeTerm, repeatedWords, stackedTerms, type Vocabulary } from "./fidelity";
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
  | "kept"
  | "fidelity"
  | "group";

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
  /**
   * When a single-source bullet breaks fidelity (2c, 2d), put the source
   * bullet's own text back (default). Tests of single checks turn it off.
   */
  restoreOriginals?: boolean;
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

/** Headings and tools for check 4b. A full-stack group ("Web") may hold both. */
const SIDE = { frontend: /front|client|\bui\b/i, backend: /back|server/i } as const;
const SIDE_SKILLS = {
  frontend: new Set(
    [
      "react",
      "react.js",
      "next.js",
      "vue",
      "vue.js",
      "nuxt",
      "angular",
      "svelte",
      "tailwind css",
      "tailwind",
      "css",
      "html",
      "sass",
      "redux",
      "jquery",
      "bootstrap",
      "vite",
      "three.js",
      "zustand",
    ].map(skillFold),
  ),
  backend: new Set(
    [
      "django",
      "flask",
      "fastapi",
      "laravel",
      "express",
      "express.js",
      "spring",
      "spring boot",
      "ruby on rails",
      "rails",
      "nestjs",
      "asp.net",
      "node.js",
      "celery",
    ].map(skillFold),
  ),
};

/** Backend services that are not infrastructure tools (check 4d). */
// Hosted services an app calls from its backend: Firebase, and LLM APIs such as the Gemini API.
const BAAS = new Set(
  ["firebase", "supabase", "appwrite", "pocketbase", "convex", "gemini api", "openai api", "claude api"].map(skillFold),
);

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
// Calibrated against pdflatex on 2026-10-30 (scripts/check-cv-fit.ts): estimates up to 75.6 compiled to one page,
// 78 spilled to two. 74 keeps a small margin.
export const LINES_PER_PAGE = 74;
const CHARS_PER_LINE = 118;
export function estimateLines(t: TailoredResume, p?: MasterProfile): number {
  const text = (s: string) => Math.max(1, Math.ceil(s.length / CHARS_PER_LINE));
  let lines = 4; // name, contact line, spacing
  lines += t.sections.length * 1.6; // headings and rules
  if (t.summary) lines += text(t.summary.text);
  lines += Math.ceil(t.skills.length / 2) + 0.5;
  for (const e of [...t.experience, ...t.projects]) {
    lines += 1.3 + e.bullets.reduce((n, b) => n + text(b.text) + 0.2, 0) + (e.tech.length ? 1 : 0);
  }
  lines += t.educationIds.length * 1.3 + t.certificationIds.length + t.awardIds.length;
  // Publications and his other sections are always on the CV (src/lib/cv/build.ts).
  if (p) {
    const lists = [
      p.publications.length ? p.publications.map((x) => `${x.title} ${x.venue ?? ""}`) : [],
      ...p.extraSections.map((s) => s.items.map((i) => i.text)),
    ].filter((x) => x.length);
    for (const items of lists) lines += 1.6 + items.reduce((n, s) => n + text(s) + 0.2, 0);
  }
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
  // Every named tool, with all its names, for the fidelity checks (2c, 2d).
  const vocab: Vocabulary = [
    ...p.skills.map((s) => [s.name, ...s.aliases]),
    ...[...p.experience.flatMap((e) => e.tech), ...p.projects.flatMap((pr) => pr.tech)].map((x) => [x]),
    ...dictionary.map(([canonical, aliases]) => [canonical, ...aliases]),
  ].filter((names) => names.some((n) => n.trim().length > 1));
  const sourceBullets = new Map(
    [...p.experience.flatMap((e) => e.bullets), ...p.projects.flatMap((pr) => pr.bullets)].map((b) => [b.id, b]),
  );
  /** His bullet with its one placement term written in (2g), when that passes every fidelity check; else his bullet. */
  const placement = placementHints(p, ctx.matched).placement;
  const placed = (text: string, id: string) => {
    const term = placement[id]?.[0];
    const m = term ? ctx.matched.find((x) => x.term === term) : undefined;
    const hit = m ? findKeyword(m, text, false, { techTerms }) : null;
    const out = m && hit ? placeTerm(text, m.term, hit, keywordForms(m)) : null;
    if (!m || !out || out === text) return text;
    const termNames = new Set(keywordForms(m).map(skillFold));
    const ok =
      !droppedDetails(text, out, ctx.jobText ?? "", vocab).length &&
      !addedDetails(text, out, vocab).filter((x) => !termNames.has(skillFold(x))).length &&
      !repeatedWords(text, out).length;
    return ok ? out : text;
  };
  /** The text a bullet's own sources state: the cited bullets, never the role's tech line or its other bullets. */
  const strictSource = (ids: string[]) =>
    ids
      .flatMap((id) => {
        const b = sourceBullets.get(id);
        if (b) return [src.get(id) ?? b.text];
        const e = p.experience.find((x) => x.id === id);
        if (e) return e.bullets.map((x) => src.get(x.id) ?? x.text);
        const pr = p.projects.find((x) => x.id === id);
        if (pr) return [pr.description, ...pr.bullets.map((x) => src.get(x.id) ?? x.text)];
        return [src.get(id) ?? ""];
      })
      .join("\n");

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

  /* 4b. Skill groups hold what their heading names: React is never under "Backend". */
  for (const [side, other] of [
    ["frontend", "backend"],
    ["backend", "frontend"],
  ] as const) {
    for (const group of resume.skills.filter((g) => SIDE[other].test(g.group))) {
      const misplaced = group.items.filter((i) => SIDE_SKILLS[side].has(skillFold(i.name)));
      if (!misplaced.length) continue;
      group.items = group.items.filter((i) => !misplaced.includes(i));
      let target = resume.skills.find((g) => SIDE[side].test(g.group));
      if (!target) resume.skills.push((target = { group: side === "frontend" ? "Frontend" : "Backend", items: [] }));
      target.items.push(...misplaced);
      issues.push({
        check: "group",
        ref: "skills",
        message: `Moved ${misplaced.map((i) => i.name).join(", ")} from "${group.group}" to "${target.group}".`,
        action: "fixed",
      });
    }
  }
  /* 4c. Programming languages sit under a Languages heading, never under Backend or Data. */
  const langGroup = () => {
    let g = resume.skills.find((x) => /lang/i.test(x.group));
    if (!g) resume.skills.unshift((g = { group: "Languages", items: [] }));
    return g;
  };
  for (const group of resume.skills.filter((g) => !/lang/i.test(g.group))) {
    const langs = group.items.filter((i) => skillById.get(i.skillId)?.category === "language");
    if (!langs.length) continue;
    group.items = group.items.filter((i) => !langs.includes(i));
    const target = langGroup();
    target.items.push(...langs);
    issues.push({
      check: "group",
      ref: "skills",
      message: `Moved ${langs.map((i) => i.name).join(", ")} from "${group.group}" to "${target.group}".`,
      action: "fixed",
    });
  }
  resume.skills = resume.skills.filter((g) => g.items.length);

  /*
   * 4d. Core skills are never trimmed: every language, framework, library, database and tool that his own
   * bullets or tech lines name stays in the skills section. Backend services such as Firebase sit under
   * Backend, not Infrastructure. Each group then puts the job's terms first.
   */
  const workText = [...p.experience, ...p.projects]
    .flatMap((x) => [...x.bullets.map((b) => b.text), x.tech.join(", ")])
    .join("\n");
  const listed = new Set(resume.skills.flatMap((g) => g.items.map((i) => i.skillId)));
  const groupFor = (s: MasterProfile["skills"][number]) => {
    const name = skillFold(s.name);
    const find = (re: RegExp, fallback: string) => {
      let g = resume.skills.find((x) => re.test(x.group));
      if (!g) resume.skills.push((g = { group: fallback, items: [] }));
      return g;
    };
    if (s.category === "language") return find(/lang/i, "Languages");
    if (BAAS.has(name) || SIDE_SKILLS.backend.has(name)) return find(SIDE.backend, "Backend");
    if (SIDE_SKILLS.frontend.has(name)) return find(SIDE.frontend, "Frontend");
    if (s.category === "database") return find(/data/i, "Data");
    if (s.category === "framework" || s.category === "library") return find(/framework|librar|backend/i, "Frameworks");
    return find(/infra|cloud|tool|devops/i, "Infrastructure");
  };
  const restored: string[] = [];
  for (const s of p.skills) {
    if (!["language", "framework", "library", "database", "cloud", "tool"].includes(s.category) || listed.has(s.id))
      continue;
    if (![s.name, ...s.aliases].some((n) => mentions(workText, n))) continue;
    if (leaks(s.name, true).length) continue;
    groupFor(s).items.push({ name: s.name, skillId: s.id });
    restored.push(s.name);
  }
  if (restored.length)
    issues.push({
      check: "skills",
      ref: "skills",
      message: `Put back ${restored.join(", ")}: your bullets or tech lines name them, so they stay in your skills.`,
      action: "fixed",
    });
  for (const group of resume.skills.filter((g) => /infra|cloud|tool|devops/i.test(g.group))) {
    const baas = group.items.filter((i) => BAAS.has(skillFold(i.name)));
    if (!baas.length) continue;
    group.items = group.items.filter((i) => !baas.includes(i));
    let target = resume.skills.find((g) => SIDE.backend.test(g.group));
    if (!target) resume.skills.push((target = { group: "Backend", items: [] }));
    target.items.push(...baas);
    issues.push({
      check: "group",
      ref: "skills",
      message: `Moved ${baas.map((i) => i.name).join(", ")} from "${group.group}" to "${target.group}".`,
      action: "fixed",
    });
  }
  const jobTerm = (name: string) => ctx.matched.some((m) => findKeyword(m, name, true, { techTerms }));
  for (const group of resume.skills) {
    group.items = [...group.items.filter((i) => jobTerm(i.name)), ...group.items.filter((i) => !jobTerm(i.name))];
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
  const checkText = (text: string, sourceIds: string[], ref: string, ownWords = false) => {
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
    for (const w of ownWords ? [] : BANNED_WORDS) {
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
    /* 2c and 2d. Fidelity: keep the source bullet's details and the job's words; add nothing the sources do not say. */
    const cited = b.sourceIds.filter((id) => sourceBullets.has(id));
    const tailoredFor = (id: string) =>
      [...resume.experience, ...resume.projects]
        .flatMap((x) => x.bullets)
        .filter((x) => x.sourceIds.includes(id))
        .map((x) => x.text)
        .join("\n");
    const dropped = [
      ...new Set(
        cited.flatMap((id) => droppedDetails(sourceBullets.get(id)!.text, tailoredFor(id), ctx.jobText ?? "", vocab)),
      ),
    ];
    const added = addedDetails(strictSource(b.sourceIds), b.text, vocab);
    const what = [
      dropped.length ? `dropped ${dropped.map((x) => `"${x}"`).join(", ")}` : "",
      added.length ? `added ${added.map((x) => `"${x}"`).join(", ")}, which this bullet's source does not say` : "",
    ]
      .filter(Boolean)
      .join(" and ");
    if (what && ctx.restoreOriginals !== false && cited.length === 1 && b.sourceIds.length === 1) {
      // One source bullet: his own words are always true, so put them back instead of asking the model again.
      const original = sourceBullets.get(cited[0])!;
      b.text = placed(original.text, cited[0]);
      b.boldPhrases = original.boldPhrases.filter((ph) => b.text.includes(ph));
      issues.push({
        check: "fidelity",
        ref,
        message: `Kept your original wording: the rewrite ${what}.`,
        action: "fixed",
      });
    } else if (what) {
      issues.push({
        check: "fidelity",
        ref,
        message: `This bullet ${what}. Keep every number, named tool, word in parentheses and word the job post uses from its sources, and add nothing they do not state.`,
        action: "fix",
      });
    }
    let own = cited.length === 1 && b.text === sourceBullets.get(cited[0])!.text;
    // 2g. His exact words, with the job's term placed once when the bullet proves it in other words.
    if (own && ctx.restoreOriginals !== false && b.sourceIds.length === 1) {
      const next = placed(b.text, cited[0]);
      if (next !== b.text) {
        b.text = next;
        own = false;
        issues.push({ check: "style", ref, message: `Placed the job's term once: "${next}".`, action: "fixed" });
      }
    }
    /* 2e and 2f. Reads like a person wrote it: no word said twice, no job terms stacked in front of the source. */
    const before = issues.length;
    // Text code wrote itself (2g) is already checked.
    const byCode = cited.length === 1 && b.text === placed(sourceBullets.get(cited[0])!.text, cited[0]);
    if (!own && !byCode && cited.length) {
      const source = cited.map((id) => sourceBullets.get(id)!.text).join(" ");
      const twice = repeatedWords(source, b.text);
      if (twice.length)
        issues.push({
          check: "style",
          ref,
          message: `Says ${twice.map((w) => `"${w}"`).join(", ")} twice. Use each word once; write the job's term in place of the source's own words for the same thing.`,
          action: "fix",
        });
      // One job term in two forms ("Firebase Auth and authentication") says the same thing twice.
      for (const m of ctx.matched) {
        // Forms inside a longer form found ("role-based access" in "role-based access control") and a gloss in
        // parentheses ("Gemini API (LLM)") name the term once, not twice.
        const outside = b.text.replace(/\([^)]*\)/g, " ");
        // Longest forms first; each found form is blanked out, so a shorter one only counts on its own.
        let rest = outside;
        const forms: string[] = [];
        for (const f of [...keywordForms(m)].sort((x, y) => y.length - x.length)) {
          if (!mentions(rest, f)) continue;
          forms.push(f);
          rest = blankOut(rest, f);
        }
        const own = keywordForms(m).filter((f) => mentions(source, f));
        const distinct = new Set(forms.map(skillFold));
        if (distinct.size > 1 && distinct.size > own.length)
          issues.push({
            check: "style",
            ref,
            message: `Says ${m.term} twice in different words (${forms.join(", ")}). Keep one.`,
            action: "fix",
          });
      }
      // One job term per bullet: more reads like keywords glued on.
      const addedTerms = ctx.matched.filter((m) => mentions(b.text, m.term) && !mentions(source, m.term));
      if (addedTerms.length > 1)
        issues.push({
          check: "style",
          ref,
          message: `Adds ${addedTerms.length} job terms (${addedTerms.map((m) => m.term).join(", ")}). Use one.`,
          action: "fix",
        });
      if (
        stackedTerms(
          source,
          b.text,
          ctx.matched.map((m) => m.term),
        )
      )
        issues.push({
          check: "style",
          ref,
          message:
            "Puts job terms in front of the unchanged source sentence. Work the term into the sentence once, in place of the words it stands for.",
          action: "fix",
        });
    }
    // 2g. A single-source bullet that does not read well gets the job's term placed in code (or his words back).
    const styleIssues = issues.slice(before).filter((i) => i.check === "style" && i.action === "fix");
    if (styleIssues.length && cited.length === 1 && b.sourceIds.length === 1 && ctx.restoreOriginals !== false) {
      issues.splice(before, issues.length - before, ...issues.slice(before).filter((i) => !styleIssues.includes(i)));
      const original = sourceBullets.get(cited[0])!;
      b.text = placed(original.text, cited[0]);
      b.boldPhrases = original.boldPhrases.filter((ph) => b.text.includes(ph));
      issues.push({
        check: "style",
        ref,
        message: `Rewrote it from your own words with the job's term placed once: "${b.text}".`,
        action: "fixed",
      });
    }
    checkText(b.text, b.sourceIds, ref, own || b.text === sourceBullets.get(cited[0] ?? "")?.text);
  };

  /* 9a. Each source bullet once: a bullet that only repeats source bullets used earlier is a duplicate. */
  const seen = new Set<string>();
  for (const item of [...resume.experience, ...resume.projects]) {
    const name =
      "experienceId" in item
        ? p.experience.find((x) => x.id === item.experienceId)?.company
        : p.projects.find((x) => x.id === item.projectId)?.name;
    item.bullets = item.bullets.filter((b, i) => {
      const ids = b.sourceIds.filter((id) => sourceBullets.has(id));
      const repeats = ids.filter((id) => seen.has(id));
      ids.forEach((id) => seen.add(id));
      if (ids.length && repeats.length === ids.length) {
        issues.push({
          check: "kept",
          ref: "resume",
          message: `Removed a repeat in ${name}: "${b.text}" uses ${repeats.join(", ")}, which another bullet already uses.`,
          action: "fixed",
        });
        return false;
      }
      if (repeats.length)
        issues.push({
          check: "kept",
          ref: `${"experienceId" in item ? "experience" : "projects"}:${"experienceId" in item ? item.experienceId : item.projectId}:${i}`,
          message: `${repeats.join(", ")} is already used by another bullet. Each source bullet appears once: write this bullet from its other sources only.`,
          action: "fix",
        });
      return true;
    });
  }

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
    const seen = new Set<string>();
    const kept = tech.filter((t) => {
      // Each tool once ("PostgreSQL, PostgreSQL" came back from the model).
      if (seen.has(skillFold(t))) return false;
      seen.add(skillFold(t));
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
    // The tech line is reordered, never trimmed: every tool the role lists stays.
    const have = new Set(kept.map(skillFold));
    const missing = allowed.filter((t) => !have.has(skillFold(t)) && !leaks(t, true).length);
    if (missing.length)
      issues.push({
        check: "tech",
        ref,
        message: `Put back ${missing.map((x) => `"${x}"`).join(", ")} on the tech line: it lists everything the role used.`,
        action: "fixed",
      });
    return [...kept, ...missing];
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

  /*
   * 9. Kept experience: every source bullet of every role, and of every project on the CV, appears exactly once.
   * A missing one comes back in his own words, unless a note says specifically why it was left out.
   */
  for (const left of leftOutBullets(resume, p)) {
    // A reason counts only when it says something specific: "irrelevant to this job" does not.
    const note = resume.notes.find((n) => n.includes(left.bulletId) && reasonWords(n) >= 6);
    if (note) {
      issues.push({
        check: "kept",
        ref: "resume",
        message: `Left out from ${left.company}: "${left.text}" (${note})`,
        action: "report",
      });
      continue;
    }
    const source = sourceBullets.get(left.bulletId)!;
    const restored = {
      text: source.text,
      boldPhrases: source.boldPhrases.filter((ph) => source.text.includes(ph)),
      sourceIds: [source.id],
      keywordsUsed: [],
    };
    if (left.section === "experience") {
      let entry = resume.experience.find((e) => e.experienceId === left.itemId);
      if (!entry) {
        entry = {
          experienceId: left.itemId,
          bullets: [],
          tech: [...(p.experience.find((e) => e.id === left.itemId)?.tech ?? [])],
        };
        resume.experience.push(entry);
        resume.experience.sort((a, b) => expIds.get(a.experienceId)! - expIds.get(b.experienceId)!);
      }
      entry.bullets.push(restored);
    } else resume.projects.find((x) => x.projectId === left.itemId)!.bullets.push(restored);
    issues.push({
      check: "kept",
      ref: "resume",
      message: `Put back ${left.bulletId} from ${left.company} in your own words ("${left.text}"): every source bullet appears once.`,
      action: "fixed",
    });
  }

  /* 8. Length. Shorten first: real experience is not dropped to fit (check 9). */
  const lines = estimateLines(resume, p);
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

export type LeftOutBullet = {
  section: "experience" | "projects";
  itemId: string;
  company: string;
  bulletId: string;
  text: string;
};

/**
 * Source bullets that no tailored bullet uses: of every role (a role left out
 * entirely included), and of every project that is on the CV. A project left
 * out as a whole is allowed; a project on the CV keeps each of its bullets.
 */
export function leftOutBullets(resume: TailoredResume, p: MasterProfile): LeftOutBullet[] {
  const used = new Set(
    [...resume.experience, ...resume.projects].flatMap((e) => e.bullets.flatMap((b) => b.sourceIds)),
  );
  const onCv = new Set(resume.projects.map((x) => x.projectId));
  return [
    ...p.experience.flatMap((e) =>
      e.bullets
        .filter((b) => !used.has(b.id))
        .map((b) => ({
          section: "experience" as const,
          itemId: e.id,
          company: e.company,
          bulletId: b.id,
          text: b.text,
        })),
    ),
    ...p.projects
      .filter((x) => onCv.has(x.id))
      .flatMap((x) =>
        x.bullets
          .filter((b) => !used.has(b.id))
          .map((b) => ({ section: "projects" as const, itemId: x.id, company: x.name, bulletId: b.id, text: b.text })),
      ),
  ];
}

/** Bullet refs and the summary that still need the model, with their messages. */
export function failing(issues: Issue[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const i of issues.filter((x) => x.action === "fix")) m.set(i.ref, [...(m.get(i.ref) ?? []), i.message]);
  return m;
}

/** The text with every occurrence of `part` (any case) replaced by spaces of the same length. */
function blankOut(text: string, part: string): string {
  const lower = text.toLowerCase();
  const p = part.toLowerCase();
  let out = text;
  for (let i = lower.indexOf(p); p && i >= 0; i = lower.indexOf(p, i + p.length)) {
    out = out.slice(0, i) + " ".repeat(p.length) + out.slice(i + p.length);
  }
  return out;
}
