"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react/ssr";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/** Light LaTeX tinting: commands in graphite, comments dimmed. */
function tintLatex(line: string) {
  if (/^\s*%/.test(line)) return <span className="text-graphite italic">{line}</span>;
  const parts = line.split(/(\\[a-zA-Z@]+\*?)/g);
  return parts.map((p, i) =>
    p.startsWith("\\") ? (
      <span key={i} className="text-graphite">
        {p}
      </span>
    ) : (
      p
    ),
  );
}

/** Read-only code view in Plex Mono with line numbers and Copy. */
export function CodeView({
  code,
  label = "LaTeX source",
  className,
  maxHeight = 520,
}: {
  code: string;
  label?: string;
  className?: string;
  maxHeight?: number;
}) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");
  return (
    <div className={cn("overflow-hidden rounded-panel border border-rule bg-sheet", className)}>
      <div className="flex items-center justify-between border-b border-rule py-1.5 pr-1.5 pl-4">
        <span className="text-sm text-graphite">{label}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
          {copied ? "Copied" : "Copy LaTeX"}
        </Button>
      </div>
      <div className="overflow-auto" style={{ maxHeight }} tabIndex={0} role="region" aria-label={label}>
        <pre className="py-3 font-mono text-[13px] leading-5 text-ink">
          <code className="grid grid-cols-[auto_1fr]">
            {lines.map((line, i) => (
              <span key={i} className="contents">
                <span className="pr-4 pl-4 text-right text-graphite/70 tabular select-none" aria-hidden>
                  {i + 1}
                </span>
                <span className="pr-4 whitespace-pre">{tintLatex(line) || " "}</span>
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
