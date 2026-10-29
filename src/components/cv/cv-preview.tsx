"use client";

import { ArrowsOutIcon } from "@phosphor-icons/react/ssr";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { Segmented } from "@/components/ui/tabs";
import type { CvDocument } from "@/lib/cv/document";
import { CvSheet } from "./cv-sheet";

/** US Letter is 612 pt wide; at this width 9 pt text is 9 CSS px. Never smaller on screen. */
export const MIN_SHEET_PX = 612;
/** True size: 8.5 in at 96 px per inch. */
export const TRUE_SHEET_PX = 816;

type Zoom = "fit" | "100" | "125";

/**
 * The CV preview with zoom: fit the column (never below MIN_SHEET_PX, so the
 * smallest CV text stays at 9 px or more), true size, or 125%. Clicking the
 * page or "Open full size" shows it at true size in a dialog. When the page is
 * wider than its column it scrolls sideways and says so.
 */
export function CvPreview({ doc, label = "CV preview" }: { doc: CvDocument; label?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [pages, setPages] = useState(1);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvailable(el.clientWidth));
    ro.observe(el);
    setAvailable(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const width =
    zoom === "fit" ? Math.max(MIN_SHEET_PX, Math.floor(available)) : zoom === "100" ? TRUE_SHEET_PX : TRUE_SHEET_PX * 1.25;
  const scrolls = available > 0 && width > available + 1;

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Segmented
          aria-label="Zoom"
          value={zoom}
          onValueChange={(v) => setZoom(v as Zoom)}
          options={[
            { value: "fit", label: "Fit width" },
            { value: "100", label: "100%" },
            { value: "125", label: "125%" },
          ]}
        />
        <Button variant="ghost" size="sm" onClick={() => setFull(true)}>
          <ArrowsOutIcon aria-hidden />
          Open full size
        </Button>
      </div>
      <div ref={frame} className="overflow-x-auto pb-2" tabIndex={scrolls ? 0 : undefined} role={scrolls ? "region" : undefined} aria-label={scrolls ? label : undefined}>
        {/* Click the page to open it full size. The keyboard path is the button above. */}
        <div
          className="w-fit cursor-zoom-in"
          onClick={(e) => {
            e.preventDefault();
            setFull(true);
          }}
        >
          <CvSheet doc={doc} width={available ? width : undefined} onPagesChange={setPages} />
        </div>
      </div>
      <p className="mt-2 text-sm text-graphite">
        {pages === 1 ? "1 page" : `${pages} pages`}, US Letter
        {scrolls ? ". Scroll sideways to read the whole page." : ""}
      </p>
      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent
          title="CV at full size"
          description="True size, as it prints."
          className="top-4 w-[min(900px,calc(100vw-16px))] translate-y-0"
        >
          <div className="max-h-[calc(100dvh-160px)] overflow-auto">
            <CvSheet doc={doc} width={TRUE_SHEET_PX} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
