"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { CvBullet, CvDocument, CvProjectEntry, CvRoleEntry, Segment } from "@/lib/cv/document";
import { cn } from "@/lib/utils";
import "./cv-sheet.css";

function Rich({ segments }: { segments: Segment[] }) {
  return <>{segments.map((s, i) => (s.bold ? <b key={i}>{s.text}</b> : <Fragment key={i}>{s.text}</Fragment>))}</>;
}

function Bullets({ bullets, tech }: { bullets: CvBullet[]; tech?: string[] }) {
  if (bullets.length === 0 && !tech?.length) return null;
  return (
    <ul className="cv-bullets">
      {bullets.map((bullet, i) => (
        <li key={i} data-bullet data-source-ids={bullet.sourceIds?.join(" ")}>
          <Rich segments={bullet.segments} />
        </li>
      ))}
      {tech && tech.length > 0 && (
        <li>
          <b>Tech:</b> <i>{tech.join(", ")}</i>
        </li>
      )}
    </ul>
  );
}

function Role({ entry }: { entry: CvRoleEntry }) {
  return (
    <div className="cv-entry">
      <div className="cv-heading">
        <div className="cv-heading-left">
          <b>{entry.orgUrl ? <a href={entry.orgUrl}>{entry.org}</a> : <u>{entry.org}</u>}</b>
          {entry.title && (
            <>
              <span className="cv-bar">|</span>
              <span className="cv-subtitle">{entry.title}</span>
            </>
          )}
        </div>
        {entry.right && <div className="cv-heading-right">{entry.right}</div>}
      </div>
      <Bullets bullets={entry.bullets} tech={entry.tech} />
    </div>
  );
}

function Project({ entry }: { entry: CvProjectEntry }) {
  return (
    <div className="cv-entry">
      <div className="cv-heading cv-small">
        <b>{entry.name}</b>
        <div>
          {entry.links.map((l, i) => (
            <Fragment key={l.url}>
              {i > 0 && <span className="cv-bar">|</span>}
              <a href={l.url}>{l.label}</a>
            </Fragment>
          ))}
        </div>
      </div>
      <Bullets bullets={entry.bullets} tech={entry.tech} />
    </div>
  );
}

/**
 * The CV on a white sheet at true US Letter proportions. Stays white in dark
 * mode. Shows a dashed page boundary when content runs past one page.
 */
export function CvSheet({
  doc,
  className,
  onPagesChange,
}: {
  doc: CvDocument;
  className?: string;
  onPagesChange?: (pages: number) => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(1);
  const [pageHeight, setPageHeight] = useState(0);

  useEffect(() => {
    const sheet = sheetRef.current;
    const content = contentRef.current;
    if (!sheet || !content) return;
    // Measure the content, not the sheet: the sheet's min-height depends on
    // the page count, so measuring it would never shrink back to 1 page.
    const measure = () => {
      const width = sheet.clientWidth;
      const pageH = (width * 11) / 8.5;
      const verticalMargins = (width / 612) * 21.6 * 2;
      const used = content.offsetHeight + verticalMargins;
      setPageHeight(pageH);
      setPages(Math.max(1, Math.ceil(used / pageH - 0.002)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(sheet);
    ro.observe(content);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [doc]);

  useEffect(() => onPagesChange?.(pages), [pages, onPagesChange]);

  return (
    <div className={cn("cv-frame", className)}>
      <div
        ref={sheetRef}
        className="cv-sheet"
        style={pages > 1 ? { minHeight: `calc(var(--page-h) * ${pages})` } : undefined}
        aria-label={`CV preview, ${pages === 1 ? "1 page" : `${pages} pages`}`}
        role="document"
      >
        <div ref={contentRef}>
          <div className="cv-name">{doc.name}</div>
          <div className="cv-contact">
            {doc.contact.map((c, i) => (
              <Fragment key={i}>
                {i > 0 && <span className="cv-bar">|</span>}
                {c.url ? <a href={c.url}>{c.text}</a> : c.text}
              </Fragment>
            ))}
          </div>

          {doc.sections.map((section, i) => (
            <section key={i}>
              <h3 className="cv-section-title">{section.title}</h3>
              {section.kind === "summary" && (
                <p className="cv-small">
                  <Rich segments={section.segments} />
                </p>
              )}
              {section.kind === "skills" && (
                <div className="cv-small">
                  {section.lines.map((line, li) => (
                    <div key={li} className="cv-skills-line">
                      {line.map((g, gi) => (
                        <Fragment key={g.group}>
                          {gi > 0 && <span className="cv-bar">|</span>}
                          <b>{g.group}</b>: {g.items.join(", ")}
                        </Fragment>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {section.kind === "entries" &&
                section.entries.map((e) =>
                  e.kind === "role" ? <Role key={e.id} entry={e} /> : <Project key={e.id} entry={e} />,
                )}
            </section>
          ))}
        </div>

        {pageHeight > 0 &&
          Array.from({ length: pages - 1 }, (_, i) => (
            <div key={i} className="cv-page-break" style={{ top: pageHeight * (i + 1) }}>
              <span>Page {i + 2} starts here</span>
            </div>
          ))}
      </div>
    </div>
  );
}
