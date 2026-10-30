"use client";

import { Upload } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** File upload: click the button or drop a file anywhere on the area. */
export function DropZone({
  accept,
  onFile,
  busy = false,
  title,
  hint,
  label,
  className,
}: {
  accept: string;
  onFile: (file: File) => void;
  busy?: boolean;
  /** Optional; leave it out when the page heading already says what to drop. */
  title?: string;
  hint: ReactNode;
  /** Accessible name of the file input. */
  label: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f && !busy) onFile(f);
      }}
      className={cn(
        "flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
        over ? "border-ring bg-info-soft" : "bg-card",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
        <Upload className="size-5" />
      </div>
      <div className="max-w-md space-y-1">
        {(title || over) && <p className="font-medium">{over ? "Drop to upload" : title}</p>}
        {!over && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      <Button type="button" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <Spinner data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
        {busy ? "Reading the file" : "Choose a file"}
      </Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={label}
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
