import type { MasterProfile } from "./schema";

/**
 * Extraction coverage, in code: every section of his CV must land somewhere
 * in the profile. The CV text is split at its headings; a section the profile
 * does not hold comes back as "unplaced", with its own text, so the profile
 * screen can show it. Nothing from the CV is dropped silently. A grade
 * (CGPA, GPA) written under Education is copied into the education entry.
 */

type Key =
  | "summary"
  | "experience"
  | "education"
  | "projects"
  | "skills"
  | "certifications"
  | "awards"
  | "languages"
  | "publications"
  | "contact"
  | "extra";

const KNOWN: [RegExp, Key][] = [
  [/^(professional |career )?(summary|profile|objective)$|^about( me)?$/, "summary"],
  [/^((work|professional|relevant|industry) )?experience$|^employment( history)?$|^work history$/, "experience"],
  [/^education( and training)?$|^academic (background|qualifications)$/, "education"],
  [/^((personal|selected|academic|key|side) )?projects$/, "projects"],
  [/^((technical|core|key) )?skills( and (tools|technologies))?$|^technologies$|^tech stack$/, "skills"],
  [/^(certifications?|certificates|licenses)( and (licenses|certifications))?$/, "certifications"],
  [/^(awards|honou?rs|achievements|accomplishments)( and (awards|honou?rs|achievements))?$/, "awards"],
  [/^languages$/, "languages"],
  [/^(publications|papers|research)( and (publications|research))?$|^research and publications$/, "publications"],
  [/^contact( information| details)?$/, "contact"],
  [
    /^(leadership|volunteering|volunteer experience|activities|extracurricular( activities)?|interests|hobbies|research interests|community|leadership and activities|extracurriculars|references|courses|coursework|relevant coursework)$/,
    "extra",
  ],
];

const fold = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** A heading line: a known section name, a markdown or LaTeX heading, or a short line in capitals. */
function headingOf(line: string): { title: string; key: Key } | null {
  const raw = line
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\\section\*?\{(.*)\}$/, "$1")
    .replace(/:$/, "")
    .trim();
  if (!raw || raw.length > 40) return null;
  const f = fold(raw);
  for (const [re, key] of KNOWN) if (re.test(f)) return { title: raw, key };
  const explicit = /^#{1,6}\s|^\\section/.test(line.trim());
  const caps = /^[\p{Lu}\d &/,-]+$/u.test(raw) && /\p{Lu}{3}/u.test(raw) && raw.split(/\s+/).length <= 4;
  return explicit || caps ? { title: raw, key: "extra" } : null;
}

export type CvSectionText = { title: string; key: Key; body: string };

/** The CV text split at its headings. Text before the first heading (name, contact) is left out. */
export function cvSections(text: string): CvSectionText[] {
  const out: CvSectionText[] = [];
  for (const line of text.split(/\r?\n/)) {
    const h = headingOf(line);
    if (h) out.push({ ...h, body: "" });
    else if (out.length) out[out.length - 1].body += `${line}\n`;
  }
  return out.map((s) => ({ ...s, body: s.body.trim() })).filter((s) => s.body);
}

const GRADE = /\b(c?gpa|grade|class)\b[\s:=-]*\(?\s*(\d(?:\.\d+)?)(\s*(?:\/|out of)\s*\d(?:\.\d+)?)?/i;

function holds(p: MasterProfile, s: CvSectionText): boolean {
  const extraMatch = () => {
    const t = fold(s.title);
    const bodyLines = s.body
      .split("\n")
      .map((l) => fold(l))
      .filter((l) => l.length > 8);
    const itemText = fold(p.extraSections.flatMap((x) => [x.title, ...x.items.map((i) => i.text)]).join(" "));
    return (
      p.extraSections.some((x) => fold(x.title) === t || fold(x.title).includes(t) || t.includes(fold(x.title))) ||
      (bodyLines.length > 0 &&
        bodyLines.filter((l) => itemText.includes(l.slice(0, 40))).length >= bodyLines.length / 2)
    );
  };
  switch (s.key) {
    case "summary":
      return Boolean(p.basics.summary) || Boolean(p.basics.headline);
    case "experience":
      return p.experience.length > 0;
    case "education":
      return p.education.length > 0;
    case "projects":
      return p.projects.length > 0;
    case "skills":
      return p.skills.length > 0;
    case "certifications":
      return p.certifications.length > 0;
    case "awards":
      return p.awards.length > 0 || extraMatch();
    case "languages":
      return p.languages.length > 0;
    case "publications":
      return p.publications.length > 0 || extraMatch();
    case "contact":
      return true;
    case "extra":
      return extraMatch();
  }
}

/**
 * Sections of the CV that the profile does not hold, and the CV's grade
 * copied into its education entry when the model left it out. Returns a new
 * profile; the input is not changed.
 */
export function checkCoverage(cvText: string, profile: MasterProfile): MasterProfile {
  const p: MasterProfile = structuredClone(profile);
  const unplaced: MasterProfile["unplaced"] = [];
  for (const s of cvSections(cvText)) {
    // A markdown CV often puts his name in a heading; that is basics, not a section.
    if (fold(s.title) === fold(p.basics.name)) continue;
    if (s.key === "education") {
      const line = s.body.split("\n").find((l) => GRADE.test(l));
      const m = line ? GRADE.exec(line) : null;
      if (m && !p.education.some((e) => e.grade?.includes(m[2]))) {
        const open = p.education.filter((e) => !e.grade);
        const grade = m[0].replace(/^\W+|\W+$/g, "").trim();
        if (open.length === 1) open[0].grade = grade;
        else unplaced.push({ id: `un_${unplaced.length + 1}`, heading: s.title, text: line!.trim() });
      }
    }
    if (!holds(p, s)) unplaced.push({ id: `un_${unplaced.length + 1}`, heading: s.title, text: s.body.slice(0, 1500) });
  }
  p.unplaced = unplaced;
  return p;
}
