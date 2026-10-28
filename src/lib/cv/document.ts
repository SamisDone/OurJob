/**
 * A rendered CV, independent of output format. The HTML preview (CvSheet)
 * and the LaTeX renderer both read this shape, so the preview and the .tex
 * file cannot drift apart. It mirrors templates/resume-sample.tex.
 */

export type Segment = { text: string; bold?: boolean };

export type CvLink = { label: string; url: string };

export type CvBullet = {
  /** Tailored bullets keep the master profile item ids they came from. */
  sourceIds?: string[];
  segments: Segment[];
};

export type CvRoleEntry = {
  kind: "role";
  id: string;
  /** Company or institution. */
  org: string;
  orgUrl?: string;
  /** Job title or degree, set in italics after a bar. */
  title: string;
  /** Dates or location, right aligned in italics. */
  right?: string;
  bullets: CvBullet[];
  tech?: string[];
};

export type CvProjectEntry = {
  kind: "project";
  id: string;
  name: string;
  links: CvLink[];
  bullets: CvBullet[];
  tech?: string[];
};

export type CvSkillGroup = { group: string; items: string[] };

export type CvSection =
  | { kind: "summary"; title: string; segments: Segment[] }
  | { kind: "skills"; title: string; lines: CvSkillGroup[][] }
  | { kind: "entries"; title: string; entries: (CvRoleEntry | CvProjectEntry)[] };

export type CvDocument = {
  name: string;
  /** Location first (plain), then email and links. */
  contact: { text: string; url?: string }[];
  sections: CvSection[];
};

/**
 * Splits text into plain and bold segments. Bold phrases must be exact
 * substrings; the first occurrence of each is used, longest phrases win when
 * they overlap, and phrases that are not found are ignored.
 */
export function boldSegments(text: string, boldPhrases: readonly string[]): Segment[] {
  const ranges: [number, number][] = [];
  const phrases = [...new Set(boldPhrases.filter((p) => p.trim().length > 0))].sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    let from = 0;
    while (from <= text.length) {
      const at = text.indexOf(phrase, from);
      if (at === -1) break;
      const end = at + phrase.length;
      if (!ranges.some(([s, e]) => at < e && end > s)) {
        ranges.push([at, end]);
        break;
      }
      from = at + 1;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const out: Segment[] = [];
  let cursor = 0;
  for (const [s, e] of ranges) {
    if (s > cursor) out.push({ text: text.slice(cursor, s) });
    out.push({ text: text.slice(s, e), bold: true });
    cursor = e;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });
  return out;
}

export function segmentsText(segments: readonly Segment[]): string {
  return segments.map((s) => s.text).join("");
}
