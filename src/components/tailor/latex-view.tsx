"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Read-only LaTeX source in Geist Mono, with line numbers and Copy. */
export function LatexView({ code, maxHeight = 640 }: { code: string; maxHeight?: number }) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b bg-muted/50 py-1.5 pr-1.5 pl-4">
        <span className="text-sm text-muted-foreground">resume.tex</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            toast("Copied the LaTeX.");
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copied ? "Copied" : "Copy LaTeX"}
        </Button>
      </div>
      <div className="overflow-auto" style={{ maxHeight }} tabIndex={0} role="region" aria-label="LaTeX source">
        <pre className="py-3 font-mono text-[13px] leading-5">
          <code className="grid grid-cols-[auto_1fr]">
            {lines.map((line, i) => (
              <span key={i} className="contents">
                <span className="pr-4 pl-4 text-right text-muted-foreground/70 tabular-nums select-none" aria-hidden>
                  {i + 1}
                </span>
                <span className="pr-4 whitespace-pre">{line || " "}</span>
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
