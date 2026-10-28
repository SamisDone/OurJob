"use client";

import { Fragment, useMemo, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PenCircle, PenUnderline } from "./pen";
import { penTiming } from "./sweep";
import "./marks.css";

export type TextMark = { start: number; end: number; kind: "matched" | "missing"; term?: string };

type Phase = "static" | "pending" | "run";

/**
 * Job description text marked up with a ballpoint: matched keywords circled
 * in blue pen, missing ones underlined in red pen. Running text is --body.
 *
 * phase "static" shows every mark. "pending" hides them; switching to "run"
 * draws the circles in reading order, then the underlines.
 */
export function MarkedText({
  text,
  marks,
  phase = "static",
  className,
  onMarkEnter,
}: {
  text: string;
  marks: TextMark[];
  phase?: Phase;
  className?: string;
  onMarkEnter?: (mark: TextMark) => void;
}) {
  const sorted = useMemo(() => [...marks].sort((a, b) => a.start - b.start), [marks]);
  const timing = penTiming(sorted.filter((m) => m.kind === "matched").length);

  const paragraphs = useMemo(() => {
    // Split on blank lines, keeping absolute offsets so marks still line up.
    const out: { start: number; end: number }[] = [];
    let last = 0;
    for (const m of text.matchAll(/\n\s*\n/g)) {
      out.push({ start: last, end: m.index ?? 0 });
      last = (m.index ?? 0) + m[0].length;
    }
    out.push({ start: last, end: text.length });
    return out.filter((p) => p.end > p.start);
  }, [text]);

  let matchedIndex = 0;

  return (
    <div
      className={cn("jd-text measure text-base text-body", className)}
      data-phase={phase}
      style={
        {
          "--draw-stagger": `${timing.staggerMs}ms`,
          "--draw-ms": `${timing.circleMs}ms`,
          "--underline-delay": `${timing.underlineDelayMs}ms`,
        } as CSSProperties
      }
    >
      {paragraphs.map((p, pi) => {
        const parts: ReactNode[] = [];
        let cursor = p.start;
        for (const m of sorted.filter((x) => x.start >= p.start && x.end <= p.end)) {
          if (m.start > cursor) parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor, m.start)}</Fragment>);
          const word = text.slice(m.start, m.end);
          const seed = `${word}:${m.start}`;
          parts.push(
            <mark
              key={`m${m.start}`}
              className="jd-mark"
              data-kind={m.kind}
              onMouseEnter={onMarkEnter ? () => onMarkEnter(m) : undefined}
            >
              {m.kind === "matched" ? (
                <PenCircle seed={seed} index={matchedIndex++}>
                  {word}
                </PenCircle>
              ) : (
                <PenUnderline seed={seed}>{word}</PenUnderline>
              )}
              <span className="sr-only">{m.kind === "matched" ? " (matched keyword)" : " (missing keyword)"}</span>
            </mark>,
          );
          cursor = m.end;
        }
        if (cursor < p.end) parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor, p.end)}</Fragment>);
        return (
          <p key={pi} className="whitespace-pre-line [&+p]:mt-4">
            {parts}
          </p>
        );
      })}
    </div>
  );
}
