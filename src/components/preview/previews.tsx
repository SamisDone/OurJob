"use client";

import { useEffect, useState } from "react";
import { TodayEmpty, TodayError, TodaySkeleton, TodayView } from "@/components/jobs/today-view";
import { TailorPaste, TailorResultView, TailorWorking, type TailorResult } from "@/components/tailor/tailor-view";
import {
  findSampleMarks,
  sampleAts,
  sampleChanges,
  sampleCv,
  sampleFeed,
  sampleJd,
  sampleLatex,
  sampleNow,
  sampleRun,
  sampleTimeZone,
} from "@/lib/design/sample";

/**
 * Dev-only previews of Today and Tailor with Nadia Chowdhury's fictional
 * data, inside the real shell. The real pages show real data only.
 */
export function TodayPreview({ state }: { state?: string }) {
  if (state === "loading") return <TodaySkeleton />;
  if (state === "empty") return <TodayEmpty run={sampleRun} timeZone={sampleTimeZone} />;
  if (state === "error") return <TodayError />;
  // "late": the last search finished two days before "now".
  const run = state === "late" ? { ...sampleRun, finishedAt: "2026-10-27T00:32:00Z" } : sampleRun;
  return (
    <TodayView
      jobs={sampleFeed}
      run={run}
      now={sampleNow}
      timeZone={sampleTimeZone}
      tailorHref={() => "/preview/tailor"}
    />
  );
}

const result: TailorResult = {
  job: { title: sampleJd.title, company: sampleJd.company, text: sampleJd.text },
  marks: findSampleMarks(sampleJd.text, sampleJd.matched, sampleJd.missing),
  cv: sampleCv,
  latex: sampleLatex,
  changes: sampleChanges,
  score: sampleAts.tailored,
  master: sampleAts.master,
  parts: sampleAts.components,
  matched: sampleJd.matched,
  missing: sampleJd.missing,
};

export function TailorPreview({ state }: { state?: string }) {
  const [phase, setPhase] = useState<"paste" | "read" | "tailor" | "check" | "done">(
    state === "paste" ? "paste" : state === "working" ? "tailor" : "done",
  );
  // Walk through the three steps when tailoring from the paste screen.
  useEffect(() => {
    if (phase === "read") {
      const t = setTimeout(() => setPhase("tailor"), 1200);
      return () => clearTimeout(t);
    }
    if (phase === "tailor" && state !== "working") {
      const t = setTimeout(() => setPhase("check"), 1800);
      return () => clearTimeout(t);
    }
    if (phase === "check") {
      const t = setTimeout(() => setPhase("done"), 900);
      return () => clearTimeout(t);
    }
  }, [phase, state]);

  if (phase === "paste") return <TailorPaste onSubmit={() => setPhase("read")} />;
  if (phase !== "paste" && phase !== "done")
    return <TailorWorking step={phase === "read" ? 0 : phase === "tailor" ? 1 : 2} />;
  return <TailorResultView result={result} onNewPost={() => setPhase("paste")} />;
}
