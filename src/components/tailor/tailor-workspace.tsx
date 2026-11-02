"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { TailorEvent } from "@/app/api/tailor/route";
import { TailorPaste, TailorWorking } from "./tailor-view";

const STEP = { reading: 0, tailoring: 1, checking: 2 } as const;

/** A little past the server's 90 s deadline, so the server's own message usually arrives first. */
export const CLIENT_LIMIT_MS = 100_000;

/**
 * Paste, then the three named steps as the server reports them, then the
 * saved tailoring. The request streams one JSON line per stage.
 */
export function TailorWorkspace({ recent, initialPost = "" }: { recent?: ReactNode; initialPost?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState(initialPost);

  const run = async (jd: string) => {
    setText(jd);
    setError(null);
    setStep(0);
    // The server gives up at 90 s; if no answer arrives by 100 s (a killed function, a dropped connection), stop here too.
    const limit = new AbortController();
    const timer = setTimeout(() => limit.abort(), CLIENT_LIMIT_MS);
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jd }),
        signal: limit.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "The server did not answer. Try again.");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const e = JSON.parse(line) as TailorEvent;
          if (e.type === "stage") setStep(STEP[e.stage]);
          if (e.type === "error") throw new Error(e.error);
          if (e.type === "done") {
            router.push(`/tailor/${e.id}`);
            return;
          }
        }
      }
      throw new Error("The connection closed before the CV was ready. Try again.");
    } catch (e) {
      setError(
        limit.signal.aborted
          ? "Tailoring took too long and was stopped. Gemini is slow right now; try again in a minute."
          : e instanceof Error
            ? e.message
            : "Something went wrong. Try again.",
      );
      setStep(null);
    } finally {
      clearTimeout(timer);
    }
  };

  if (step !== null) return <TailorWorking step={step} />;
  return <TailorPaste key={error ?? "paste"} initial={text} error={error} onSubmit={run} below={recent} />;
}
