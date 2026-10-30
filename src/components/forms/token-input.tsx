"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** A list of short strings: target titles, excluded companies, keywords. */
export function TokenInput({
  id,
  values,
  onChange,
  placeholder,
  label,
  max = 20,
  invalid,
}: {
  id?: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  /** Accessible name of the text box and the remove buttons. */
  label: string;
  max?: number;
  invalid?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || values.some((x) => x.toLowerCase() === v.toLowerCase()) || values.length >= max) return;
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <ul aria-label={label} className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <li key={v}>
              <Badge variant="secondary" className="h-7 gap-1 pr-1 text-sm font-normal">
                {v}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-6 rounded-full"
                  aria-label={`Remove ${v}`}
                  onClick={() => onChange(values.filter((x) => x !== v))}
                >
                  <X />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id={id}
          aria-label={id ? undefined : label}
          aria-invalid={invalid || undefined}
          value={draft}
          placeholder={placeholder}
          disabled={values.length >= max}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()} aria-label={`Add to ${label}`}>
          <Plus data-icon="inline-start" />
          Add
        </Button>
      </div>
    </div>
  );
}
