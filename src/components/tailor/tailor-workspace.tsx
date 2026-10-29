"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { TailorEvent } from "@/app/api/tailor/route";
import { TailorPaste, TailorWorking } from "./tailor-view";

const STEP = { reading: 0, tailoring: 1, checking: 2 } as const;

/**
 * Paste, then the three named steps as the server reports them, then the
 * saved tailoring. The request streams one JSON line per stage.
 */
export function TailorWorkspace({ recent }: { recent?: ReactNode }) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");

  const run = async (jd: string) => {
    setText(jd);
    setError(null);
    setStep(0);
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jd }),
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
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setStep(null);
    }
  };

  if (step !== null) return <TailorWorking step={step} />;
  return <TailorPaste key={error ?? "paste"} initial={text} error={error} onSubmit={run} below={recent} />;
}
