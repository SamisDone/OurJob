"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Text that becomes a text area on click (or Enter). Ctrl/Cmd + Enter saves,
 * Escape cancels. Wording only: the server checks the rest.
 */
export function EditableText({
  value,
  onSave,
  label,
  display,
  placeholder = "Add text",
  className,
  multiline = true,
}: {
  value: string;
  onSave: (next: string) => void;
  label: string;
  display?: ReactNode;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={`Edit ${label}`}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={cn(
          "-mx-1.5 block w-[calc(100%+12px)] rounded-[6px] px-1.5 py-0.5 text-left transition-colors duration-[120ms] ease-ink hover:bg-ink-wash",
          !value && "text-graphite italic",
          className,
        )}
      >
        {value ? (display ?? value) : placeholder}
      </button>
    );
  }

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== value) onSave(next);
  };

  return (
    <div className="space-y-2">
      <Textarea
        autoFocus
        aria-label={label}
        value={draft}
        rows={multiline ? 2 : 1}
        className="min-h-0 text-[15px] leading-6"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !multiline)) {
            e.preventDefault();
            commit();
          }
        }}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={commit} disabled={!draft.trim()}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
