import type { ReactNode } from "react";

export type Mark = { start: number; end: number; kind: "matched" | "missing"; term: string };

/**
 * The job post with matched and missing words washed in their status color:
 * green for matched, red for missing. Marks are <mark> elements with their
 * meaning in the accessible name, so color is never the only signal.
 */
export function MarkedPost({ text, marks }: { text: string; marks: Mark[] }) {
  const out: ReactNode[] = [];
  let at = 0;
  marks.forEach((m, i) => {
    if (m.start > at) out.push(text.slice(at, m.start));
    out.push(
      <mark
        key={i}
        aria-label={`${text.slice(m.start, m.end)}, ${m.kind === "matched" ? "matched keyword" : "missing keyword"}`}
        className={m.kind === "matched" ? "mark-matched" : "mark-missing"}
      >
        {text.slice(m.start, m.end)}
      </mark>,
    );
    at = m.end;
  });
  if (at < text.length) out.push(text.slice(at));

  return <p className="leading-7 whitespace-pre-line">{out}</p>;
}
