import type { MasterProfile, TailoredResume } from "@/lib/profile/schema";
import { boldSegments, type CvDocument, type CvProjectEntry, type CvRoleEntry, type CvSection } from "./document";

/**
 * The CvDocument for the master profile (no tailored resume) or for a
 * tailored resume. Names, titles, dates and institutions always come from the
 * profile by id, so tailoring cannot change them. The HTML preview and the
 * LaTeX renderer both read the result.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2023-06" is "Jun 2023", "2023" stays, "present" is "Present". */
export function formatMonth(d: string | undefined): string {
  if (!d) return "";
  if (/^present$/i.test(d.trim())) return "Present";
  const m = d.match(/^(\d{4})-(\d{2})/);
  if (m) return `${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}`.trim();
  return d;
}

/** "Jun 2023 – Present". The LaTeX renderer turns the en dash into "--". */
export const dateRange = (start?: string, end?: string) =>
  [formatMonth(start), formatMonth(end)].filter(Boolean).join(" – ");

const SECTION_TITLES = {
  summary: "Summary",
  skills: "Technical Skills",
  experience: "Professional Experience",
  projects: "Projects",
  education: "Education",
} as const;

/** The master CV's skill groups, from the profile's categories. Soft skills are left out, as on his CV. */
const MASTER_GROUPS: [string, string[]][] = [
  ["Languages", ["language"]],
  ["Frameworks", ["framework", "library"]],
  ["Data", ["database"]],
  ["Infrastructure", ["cloud", "tool"]],
  ["Practices", ["practice", "domain"]],
];

/** Two short groups share a line, as in the template; long groups get their own. */
function packLines(groups: { group: string; items: string[] }[]) {
  const lines: { group: string; items: string[] }[][] = [];
  for (const g of groups.filter((x) => x.items.length)) {
    const last = lines[lines.length - 1];
    const short = (x: { items: string[] }) => x.items.join(", ").length <= 40;
    if (last && last.length === 1 && short(last[0]) && short(g)) last.push(g);
    else lines.push([g]);
  }
  return lines;
}

export function buildCvDocument(p: MasterProfile, t?: TailoredResume): CvDocument {
  const contact = [
    ...(p.basics.location ? [{ text: p.basics.location }] : []),
    ...(p.basics.email ? [{ text: p.basics.email, url: `mailto:${p.basics.email}` }] : []),
    ...p.basics.links.map((l) => ({ text: l.label, url: l.url })),
  ];

  const roles: CvRoleEntry[] = (t ? t.experience : p.experience.map((e) => ({ experienceId: e.id }))).flatMap((x) => {
    const e = p.experience.find((r) => r.id === x.experienceId);
    if (!e) return [];
    const tailored = t?.experience.find((r) => r.experienceId === e.id);
    return [
      {
        kind: "role" as const,
        id: e.id,
        org: e.company,
        orgUrl: e.companyUrl,
        title: e.title,
        right: dateRange(e.start, e.end),
        bullets: tailored
          ? tailored.bullets.map((b) => ({ sourceIds: b.sourceIds, segments: boldSegments(b.text, b.boldPhrases) }))
          : e.bullets.map((b) => ({ sourceIds: [b.id], segments: boldSegments(b.text, b.boldPhrases) })),
        tech: tailored ? tailored.tech : e.tech,
      },
    ];
  });

  const projects: CvProjectEntry[] = (t ? t.projects : p.projects.map((x) => ({ projectId: x.id }))).flatMap((x) => {
    const pr = p.projects.find((y) => y.id === x.projectId);
    if (!pr) return [];
    const tailored = t?.projects.find((y) => y.projectId === pr.id);
    return [
      {
        kind: "project" as const,
        id: pr.id,
        name: pr.name,
        links: [
          ...(pr.liveUrl ? [{ label: "Live", url: pr.liveUrl }] : []),
          ...(pr.sourceUrl ? [{ label: "Source", url: pr.sourceUrl }] : []),
        ],
        bullets: tailored
          ? tailored.bullets.map((b) => ({ sourceIds: b.sourceIds, segments: boldSegments(b.text, b.boldPhrases) }))
          : pr.bullets.map((b) => ({ sourceIds: [b.id], segments: boldSegments(b.text, b.boldPhrases) })),
        tech: tailored ? tailored.tech : pr.tech,
      },
    ];
  });

  const education: CvRoleEntry[] = (t ? t.educationIds : p.education.map((e) => e.id)).flatMap((id) => {
    const e = p.education.find((x) => x.id === id);
    if (!e) return [];
    return [
      {
        kind: "role" as const,
        id: e.id,
        org: e.institution,
        title: [e.field && !e.degree.includes(e.field) ? `${e.degree} in ${e.field}` : e.degree, e.grade]
          .filter(Boolean)
          .join(", "),
        right: e.location ?? dateRange(e.start, e.end),
        bullets: [],
      },
    ];
  });

  const skillGroups = t
    ? t.skills.map((g) => ({ group: g.group, items: g.items.map((i) => i.name) }))
    : MASTER_GROUPS.map(([group, cats]) => ({
        group,
        items: p.skills.filter((s) => cats.includes(s.category)).map((s) => s.name),
      }));

  const summaryText = t ? t.summary?.text : p.basics.summary?.text;
  const order = t?.sections ?? (["summary", "skills", "experience", "projects", "education"] as const);

  const sections: CvSection[] = order.flatMap((id): CvSection[] => {
    if (id === "summary" && summaryText)
      return [{ kind: "summary", title: SECTION_TITLES.summary, segments: [{ text: summaryText }] }];
    if (id === "skills") return [{ kind: "skills", title: SECTION_TITLES.skills, lines: packLines(skillGroups) }];
    if (id === "experience" && roles.length)
      return [{ kind: "entries", title: SECTION_TITLES.experience, entries: roles }];
    if (id === "projects" && projects.length)
      return [{ kind: "entries", title: SECTION_TITLES.projects, entries: projects }];
    if (id === "education" && education.length)
      return [{ kind: "entries", title: SECTION_TITLES.education, entries: education }];
    return [];
  });

  // Publications and his other sections (Leadership, Volunteering) are facts as written: always on the CV, last.
  if (p.publications.length)
    sections.push({
      kind: "list",
      title: "Publications",
      items: p.publications.map((x) => [
        { text: x.title, bold: true },
        {
          text: [x.venue, formatMonth(x.date)]
            .filter(Boolean)
            .map((s) => `, ${s}`)
            .join(""),
        },
      ]),
    });
  for (const s of p.extraSections)
    if (s.items.length) sections.push({ kind: "list", title: s.title, items: s.items.map((i) => [{ text: i.text }]) });

  return { name: p.basics.name, contact, sections };
}
