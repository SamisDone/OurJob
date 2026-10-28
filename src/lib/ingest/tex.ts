import type { Segment } from "@/lib/cv/document";
import { latexInline, latexToPlain, readGroup, stripComments } from "@/lib/latex/inline";

/**
 * Structural parser for CVs in Jake's Resume layout (templates/resume-sample.tex):
 * \section, \resumeSubheading{org}{title}{right}, \resumeProjectHeading{name}{links},
 * \resumeItem, \tech, \lnk. The result goes to P1 as <source kind="cv_tex">.
 * Returns null when the file does not look like this layout, so the caller
 * can fall back to sending plain text.
 */

export type TexBullet = { text: string; boldPhrases: string[] };

export type TexEntry =
  | {
      kind: "role";
      org: string;
      orgUrl?: string;
      title: string;
      right: string;
      bullets: TexBullet[];
      tech: string[];
    }
  | {
      kind: "project";
      name: string;
      links: { label: string; url: string }[];
      bullets: TexBullet[];
      tech: string[];
    };

export type TexSection =
  | { title: string; kind: "text"; text: string; boldPhrases: string[] }
  | { title: string; kind: "skills"; groups: { group: string; items: string[] }[] }
  | { title: string; kind: "entries"; entries: TexEntry[] };

export type ParsedTexCv = {
  name: string;
  contact: { location?: string; email?: string; phone?: string; links: { label: string; url: string }[] };
  sections: TexSection[];
};

function toBullet(segments: Segment[]): TexBullet {
  return {
    text: segments.map((s) => s.text).join(""),
    boldPhrases: segments
      .filter((s) => s.bold)
      .map((s) => s.text.trim())
      .filter(Boolean),
  };
}

/** Finds `\name` followed by n {groups}. Returns args and end index, or null. */
function readCommandArgs(s: string, at: number, name: string, n: number): { args: string[]; end: number } | null {
  let i = at + name.length + 1;
  const args: string[] = [];
  for (let k = 0; k < n; k++) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] !== "{") return null;
    const [arg, j] = readGroup(s, i);
    args.push(arg);
    i = j;
  }
  return { args, end: i };
}

const TOKEN = /\\(resumeSubheading|resumeProjectHeading|resumeItem|tech)(?![a-zA-Z])/g;

function parseEntries(body: string): TexEntry[] {
  const entries: TexEntry[] = [];
  let current: TexEntry | null = null;
  for (const m of body.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    const name = m[1];
    if (name === "resumeSubheading") {
      const r = readCommandArgs(body, at, name, 3);
      if (!r) continue;
      const org = latexInline(r.args[0]);
      current = {
        kind: "role",
        org: org.segments
          .map((x) => x.text)
          .join("")
          .trim(),
        orgUrl: org.links[0]?.url,
        title: latexToPlain(r.args[1]).trim(),
        right: latexToPlain(r.args[2]).trim(),
        bullets: [],
        tech: [],
      };
      entries.push(current);
    } else if (name === "resumeProjectHeading") {
      const r = readCommandArgs(body, at, name, 2);
      if (!r) continue;
      current = {
        kind: "project",
        name: latexToPlain(r.args[0]).trim(),
        links: latexInline(r.args[1]).links,
        bullets: [],
        tech: [],
      };
      entries.push(current);
    } else if (name === "resumeItem" && current) {
      const r = readCommandArgs(body, at, name, 1);
      if (!r) continue;
      current.bullets.push(toBullet(latexInline(r.args[0]).segments));
    } else if (name === "tech" && current) {
      const r = readCommandArgs(body, at, name, 1);
      if (!r) continue;
      current.tech = latexToPlain(r.args[0])
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }
  return entries;
}

function parseSkills(body: string): { group: string; items: string[] }[] {
  const groups: { group: string; items: string[] }[] = [];
  const re = /\\textbf\s*\{/g;
  for (const m of body.matchAll(re)) {
    const open = (m.index ?? 0) + m[0].length - 1;
    const [name, j] = readGroup(body, open);
    let k = j;
    while (k < body.length && /\s/.test(body[k])) k++;
    let itemsSrc = "";
    if (body[k] === "{") [itemsSrc] = readGroup(body, k);
    else {
      // Plain form: \textbf{Group}: a, b, c \\ or $|$
      const rest = body.slice(k);
      itemsSrc = rest.split(/\\\\|\$\|\$|\\textbf/)[0];
    }
    const items = latexToPlain(itemsSrc)
      .replace(/^\s*:\s*/, "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    groups.push({ group: latexToPlain(name).trim(), items });
  }
  return groups;
}

function parseHeader(head: string): Pick<ParsedTexCv, "name" | "contact"> {
  const nameMatch = /\\(?:huge|Huge|LARGE|Large)\b([\s\S]*?)\}/.exec(head);
  const nameSrc = nameMatch ? nameMatch[1] : head.split("\\\\")[0];
  const name = latexToPlain(nameSrc.replace(/\\scshape|\\bfseries/g, "")).trim();
  const afterName = nameMatch ? head.slice((nameMatch.index ?? 0) + nameMatch[0].length) : head;
  const contact: ParsedTexCv["contact"] = { links: [] };
  for (const part of afterName.split(/\$\|\$|\\textbar\b|\|/)) {
    const inline = latexInline(part);
    const text = inline.segments
      .map((s) => s.text)
      .join("")
      .trim();
    if (!text && inline.links.length === 0) continue;
    for (const link of inline.links) {
      if (link.url.startsWith("mailto:")) contact.email = link.url.slice(7);
      else if (link.url.startsWith("tel:")) contact.phone = link.url.slice(4);
      else contact.links.push(link);
    }
    if (inline.links.length === 0 && text) {
      if (/@/.test(text)) contact.email = text;
      else if (/^\+?[\d\s()-]{7,}$/.test(text)) contact.phone = text;
      else if (!contact.location) contact.location = text;
    }
  }
  return { name, contact };
}

export function parseTexCv(tex: string): ParsedTexCv | null {
  const src = stripComments(tex);
  const begin = src.indexOf("\\begin{document}");
  const end = src.lastIndexOf("\\end{document}");
  if (begin === -1) return null;
  const doc = src.slice(begin + "\\begin{document}".length, end === -1 ? undefined : end);

  const sectionRe = /\\section\*?\s*\{/g;
  const starts = [...doc.matchAll(sectionRe)].map((m) => m.index ?? 0);
  if (starts.length === 0) return null;

  const { name, contact } = parseHeader(doc.slice(0, starts[0]));
  const sections: TexSection[] = [];
  starts.forEach((start, idx) => {
    const open = doc.indexOf("{", start);
    const [titleSrc, afterTitle] = readGroup(doc, open);
    const title = latexToPlain(titleSrc).trim();
    const body = doc.slice(afterTitle, starts[idx + 1] ?? doc.length);
    if (/\\resume(Sub|Project)[hH]eading/.test(body)) {
      sections.push({ title, kind: "entries", entries: parseEntries(body) });
    } else if (/skill/i.test(title) || /\\textbf\s*\{[^}]*\}\s*\{\s*:/.test(body)) {
      sections.push({ title, kind: "skills", groups: parseSkills(body) });
    } else {
      const seg = latexInline(body.replace(/\\begin\{itemize\}(\[[^\]]*\])?|\\end\{itemize\}|\\item\b/g, " "));
      sections.push({
        title,
        kind: "text",
        text: seg.segments
          .map((s) => s.text)
          .join("")
          .trim(),
        boldPhrases: seg.segments.filter((s) => s.bold).map((s) => s.text.trim()),
      });
    }
  });

  const hasStructure = sections.some((s) => s.kind === "entries" && s.entries.length > 0);
  if (!name || !hasStructure) return null;
  return { name, contact, sections };
}

/** Readable text rendering of a parsed CV, with bold kept as **...** for P1. */
export function texCvToText(cv: ParsedTexCv): string {
  const lines: string[] = [`# ${cv.name}`];
  const c = cv.contact;
  lines.push([c.location, c.email, c.phone, ...c.links.map((l) => `${l.label}: ${l.url}`)].filter(Boolean).join(" | "));
  const bold = (b: TexBullet) => b.boldPhrases.reduce((t, p) => t.replace(p, `**${p}**`), b.text);
  for (const s of cv.sections) {
    lines.push("", `## ${s.title}`);
    if (s.kind === "text") lines.push(s.text);
    if (s.kind === "skills") for (const g of s.groups) lines.push(`${g.group}: ${g.items.join(", ")}`);
    if (s.kind === "entries") {
      for (const e of s.entries) {
        if (e.kind === "role") lines.push(`### ${e.org}${e.orgUrl ? ` (${e.orgUrl})` : ""} | ${e.title} | ${e.right}`);
        else
          lines.push(
            `### ${e.name}${e.links.length ? ` | ${e.links.map((l) => `${l.label}: ${l.url}`).join(" | ")}` : ""}`,
          );
        for (const b of e.bullets) lines.push(`- ${bold(b)}`);
        if (e.tech.length) lines.push(`Tech: ${e.tech.join(", ")}`);
      }
    }
  }
  return lines.join("\n").trim() + "\n";
}
