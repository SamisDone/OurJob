"use client";

import { PlusIcon, UploadSimpleIcon } from "@phosphor-icons/react/ssr";
import { Switch as S } from "radix-ui";
import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { TokenChip } from "./chip";
import { Input } from "./input";

/** On/off setting with its label and an optional hint. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  hint,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  hint?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-6", className)}>
      <label htmlFor={id} className="min-w-0 text-sm">
        <span className="block font-medium text-body">{label}</span>
        {hint && <span className="mt-0.5 block text-graphite">{hint}</span>}
      </label>
      <S.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={cn(
          "relative inline-flex h-6 w-10 shrink-0 items-center rounded-pill border border-control-edge bg-paper transition-colors duration-[120ms] ease-ink",
          "data-[state=checked]:border-ink data-[state=checked]:bg-ink max-md:mt-1",
        )}
      >
        <S.Thumb className="block size-4 translate-x-[3px] rounded-pill bg-control-edge transition-transform duration-[120ms] ease-ink data-[state=checked]:translate-x-[19px] data-[state=checked]:bg-sheet" />
      </S.Root>
    </div>
  );
}

/** A list of short strings: target titles, excluded companies, keywords. */
export function TokenInput({
  values,
  onChange,
  placeholder,
  label,
  max = 20,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  label: string;
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || values.some((x) => x.toLowerCase() === v.toLowerCase()) || values.length >= max) return;
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div>
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {values.map((v) => (
            <TokenChip key={v} onRemove={() => onChange(values.filter((x) => x !== v))}>
              {v}
            </TokenChip>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          aria-label={label}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="secondary" onClick={add} disabled={!draft.trim()} aria-label={`Add to ${label}`}>
          <PlusIcon aria-hidden />
          Add
        </Button>
      </div>
    </div>
  );
}

/** Choose several from a short list: seniority, employment types. Toggle chips with aria-pressed. */
export function MultiToggle<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cn(
              "inline-flex h-8 items-center rounded-pill border px-3 text-sm transition-colors duration-[120ms] ease-ink max-md:h-10",
              on ? "border-ink bg-ink text-sheet" : "border-rule bg-sheet text-body hover:border-graphite",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Large drop zone for a file. Click or drop. */
export function DropZone({
  accept,
  onFile,
  busy = false,
  title,
  hint,
  className,
}: {
  accept: string;
  onFile: (file: File) => void;
  busy?: boolean;
  title: string;
  hint: ReactNode;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f && !busy) onFile(f);
      }}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-panel border-2 border-dashed px-6 py-12 text-center transition-colors duration-200 ease-ink",
        over ? "border-ink bg-ink-wash" : "border-control-edge bg-sheet",
        className,
      )}
    >
      <UploadSimpleIcon size={28} aria-hidden className="text-graphite" />
      <p className="mt-3 text-lg font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-md text-sm text-graphite">{hint}</p>
      <Button className="mt-5" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? "Reading the file" : "Choose a file"}
      </Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={title}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

const SOURCE_TEXT: Record<string, string> = {
  cv: "CV",
  linkedin: "LinkedIn",
  github: "GitHub",
  portfolio: "Portfolio",
  notes: "Your notes",
  user_added: "Added by you",
};

/** Small labels saying where a profile item came from. */
export function SourceBadges({ sources, className }: { sources: string[]; className?: string }) {
  if (sources.length === 0) return null;
  return (
    <span
      className={cn("inline-flex flex-wrap gap-1 align-middle", className)}
      aria-label={`From ${sources.map((s) => SOURCE_TEXT[s] ?? s).join(", ")}`}
    >
      {sources.map((s) => (
        <span
          key={s}
          aria-hidden
          className={cn(
            "inline-flex h-5 items-center rounded-[4px] border px-1.5 text-xs leading-none",
            s === "user_added" ? "border-ink/40 text-ink" : "border-rule text-graphite",
          )}
        >
          {SOURCE_TEXT[s] ?? s}
        </span>
      ))}
    </span>
  );
}
