import { keywordForms } from "@/lib/ats/match";
import { scoreCv } from "@/lib/ats/score";
import { profileSections, tailoredSections } from "@/lib/ats/sections";
import type { AtsReport } from "@/lib/jobs/types";
import type { JobSpec, MasterProfile, TailoredResume } from "@/lib/profile/schema";
import { estimateLines, LINES_PER_PAGE } from "./validate";

/** What the tailoring screen shows besides the CV: scores, changes, and the marked-up job post. */

const SKILL_GROUPS: [string, string[]][] = [
  ["Languages", ["language"]],
  ["Frameworks", ["framework", "library"]],
  ["Data", ["database"]],
  ["Infrastructure", ["cloud", "tool"]],
  ["Practices", ["practice", "domain"]],
];

/** The master profile as a TailoredResume: every role, bullet and project, for the master score and its length. */
export function profileAsResume(p: MasterProfile): TailoredResume {
  return {
    headline: p.basics.headline ?? p.experience[0]?.title ?? "",
    summary: p.basics.summary ? { text: p.basics.summary.text, sourceIds: [p.basics.summary.id] } : undefined,
    sections: ["summary", "skills", "experience", "projects", "education"],
    skills: SKILL_GROUPS.map(([group, cats]) => ({
      group,
      items: p.skills.filter((s) => cats.includes(s.category)).map((s) => ({ name: s.name, skillId: s.id })),
    })).filter((g) => g.items.length),
    experience: p.experience.map((e) => ({
      experienceId: e.id,
      bullets: e.bullets.map((b) => ({
        text: b.text,
        boldPhrases: b.boldPhrases,
        sourceIds: [b.id],
        keywordsUsed: [],
      })),
      tech: e.tech,
    })),
    projects: p.projects.map((pr) => ({
      projectId: pr.id,
      bullets: pr.bullets.map((b) => ({
        text: b.text,
        boldPhrases: b.boldPhrases,
        sourceIds: [b.id],
        keywordsUsed: [],
      })),
      tech: pr.tech,
    })),
    educationIds: p.education.map((e) => e.id),
    certificationIds: [],
    awardIds: [],
    notes: [],
  };
}

export const estimatePages = (r: TailoredResume) => Math.max(1, Math.ceil(estimateLines(r) / LINES_PER_PAGE));

/** The master CV's and the tailored CV's estimated ATS scores for one job. */
export function atsReports(spec: JobSpec, p: MasterProfile, tailored: TailoredResume, now = new Date()) {
  const masterSections = profileSections(p);
  const master: AtsReport = scoreCv(
    { spec, sections: masterSections, profile: p, masterSections, pages: estimatePages(profileAsResume(p)) },
    now,
  );
  const tailoredReport: AtsReport = scoreCv(
    { spec, sections: tailoredSections(tailored, p), profile: p, masterSections, pages: estimatePages(tailored) },
    now,
  );
  return { master, tailored: tailoredReport };
}

export type CvChange =
  | { kind: "rewritten"; where: string; before: string; after: string }
  | { kind: "moved"; where: string; text: string; note: string }
  | { kind: "dropped"; where: string; text: string; reason: string };

/** Every bullet that was reworded, and every role or project bullet that was left out, with why. */
export function cvChanges(p: MasterProfile, t: TailoredResume): CvChange[] {
  const out: CvChange[] = [];
  const sources = new Map(
    [...p.experience.map((e) => [e.company, e] as const), ...p.projects.map((x) => [x.name, x] as const)].flatMap(
      ([where, item]) => item.bullets.map((b) => [b.id, { where, text: b.text }] as const),
    ),
  );
  const used = new Set<string>();
  for (const b of [...t.experience, ...t.projects].flatMap((x) => x.bullets)) {
    b.sourceIds.forEach((id) => used.add(id));
    const src = b.sourceIds.map((id) => sources.get(id)).filter(Boolean) as { where: string; text: string }[];
    if (!src.length) continue;
    const before = src.map((s) => s.text).join(" ");
    if (before.replace(/\*\*/g, "").trim() !== b.text.trim())
      out.push({ kind: "rewritten", where: src[0].where, before: before.replace(/\*\*/g, ""), after: b.text });
  }
  for (const [id, s] of sources) {
    if (used.has(id)) continue;
    const note = t.notes.find((n) => n.includes(id));
    const isRole = p.experience.some((e) => e.bullets.some((b) => b.id === id));
    out.push({
      kind: "dropped",
      where: s.where,
      text: s.text.replace(/\*\*/g, ""),
      reason: note
        ? note.replace(/^Left out [^:]*:\s*/, "")
        : isRole
          ? "Not used in this CV."
          : "Project left out: it does not help this job.",
    });
  }
  return out;
}

export type JobMark = { start: number; end: number; kind: "matched" | "missing"; term: string };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Where matched and missing keywords appear in the job post, without overlaps. Ambiguous short names keep their case. */
export function jobMarks(
  text: string,
  matched: { term: string; canonical?: string; synonyms?: string[] }[],
  missing: { term: string; canonical?: string; synonyms?: string[] }[],
): JobMark[] {
  const marks: JobMark[] = [];
  const add = (k: { term: string; canonical?: string; synonyms?: string[] }, kind: JobMark["kind"]) => {
    for (const form of keywordForms(k).sort((a, b) => b.length - a.length)) {
      const exactCase = form.length <= 4 && /^[A-Z]/.test(form);
      const re = new RegExp(`(?<![\\w.+#])${escapeRe(form)}(?![\\w+#])`, exactCase ? "g" : "gi");
      for (const m of text.matchAll(re)) {
        const start = m.index ?? 0;
        const end = start + m[0].length;
        if (!marks.some((x) => start < x.end && end > x.start)) marks.push({ start, end, kind, term: k.term });
      }
    }
  };
  matched.forEach((k) => add(k, "matched"));
  missing.forEach((k) => add(k, "missing"));
  return marks.sort((a, b) => a.start - b.start);
}
