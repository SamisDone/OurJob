"use client";

import { Fragment, useMemo, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { sweepTiming } from "./sweep";
import "./marks.css";

export type TextMark = { start: number; end: number; kind: "matched" | "missing"; term?: string };

type Phase = "static" | "pending" | "run";

/**
 * Job description text marked up like a proof: matched keywords get the
 * highlighter, missing ones the proofreader's magenta underline.
 *
 * phase "static" shows all marks. "pending" hides them; switching to "run"
 * plays the sweep in reading order.
 */
export function HighlightedText({
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
  const matchedCount = sorted.filter((m) => m.kind === "matched").length;
  const timing = sweepTiming(matchedCount);

  const paragraphs = useMemo(() => {
    // Split into paragraphs on blank lines, keeping absolute offsets.
    const out: { start: number; end: number }[] = [];
    const re = /\n\s*\n/g;
    let last = 0;
    for (const m of text.matchAll(re)) {
      out.push({ start: last, end: m.index ?? 0 });
      last = (m.index ?? 0) + m[0].length;
    }
    out.push({ start: last, end: text.length });
    return out.filter((p) => p.end > p.start);
  }, [text]);

  let matchedIndex = 0;

  return (
    <div
      className={cn("jd-text measure text-base text-ink", className)}
      data-phase={phase}
      style={
        {
          "--sweep-stagger": `${timing.staggerMs}ms`,
          "--sweep-fill": `${timing.fillMs}ms`,
          "--sweep-underline-delay": `${timing.underlineDelayMs}ms`,
        } as CSSProperties
      }
    >
      {paragraphs.map((p, pi) => {
        const inPara = sorted.filter((m) => m.start >= p.start && m.end <= p.end);
        const parts: React.ReactNode[] = [];
        let cursor = p.start;
        for (const m of inPara) {
          if (m.start > cursor) parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor, m.start)}</Fragment>);
          const i = m.kind === "matched" ? matchedIndex++ : 0;
          parts.push(
            <mark
              key={`m${m.start}`}
              className="jd-mark"
              data-kind={m.kind}
              style={{ "--i": i } as CSSProperties}
              onMouseEnter={onMarkEnter ? () => onMarkEnter(m) : undefined}
            >
              {text.slice(m.start, m.end)}
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
