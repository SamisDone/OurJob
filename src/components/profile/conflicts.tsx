"use client";

import { WarningIcon } from "@phosphor-icons/react/ssr";
import { useState } from "react";
import { Button } from "@/components/legacy/button";
import { formatCvDate } from "@/lib/profile/dates";
import { conflictLabel, type EditOp } from "@/lib/profile/edit";
import type { MasterProfile } from "@/lib/profile/schema";
import { cn } from "@/lib/utils";

const SOURCE: Record<string, string> = {
  cv: "your CV",
  linkedin: "LinkedIn",
  github: "GitHub",
  portfolio: "your portfolio",
  notes: "your notes",
  user_added: "you",
};

const ATTRIBUTE: Record<string, string> = {
  start: "start date",
  end: "end date",
  title: "title",
  company: "company name",
  degree: "degree",
  institution: "institution",
  location: "location",
  name: "name",
  email: "email",
};

/**
 * Places where his sources disagree. Never picked silently: he chooses a
 * value for each, and the profile cannot be confirmed until all are chosen.
 */
export function ConflictsPanel({
  profile,
  onResolve,
  pending,
}: {
  profile: MasterProfile;
  onResolve: (op: EditOp) => void;
  pending?: boolean;
}) {
  if (profile.conflicts.length === 0) return null;
  const n = profile.conflicts.length;
  return (
    <section
      aria-labelledby="conflicts-h"
      className="red-rule-top relative rounded-panel border border-caution/40 bg-caution-wash px-5 pt-5 pb-4 md:px-6"
    >
      <h2 id="conflicts-h" className="flex items-center gap-2 text-lg font-semibold">
        <WarningIcon size={20} aria-hidden className="text-caution" />
        Your sources disagree on {n === 1 ? "one thing" : `${n} things`}
      </h2>
      <p className="mt-1 text-sm text-body">
        Choose the right value for each. The CV&apos;s value is used until you do.
      </p>
      <ul className="mt-4 divide-y divide-rule">
        {profile.conflicts.map((c) => (
          <ConflictRow key={c.field} profile={profile} conflict={c} onResolve={onResolve} pending={pending} />
        ))}
      </ul>
    </section>
  );
}

function ConflictRow({
  profile,
  conflict,
  onResolve,
  pending,
}: {
  profile: MasterProfile;
  conflict: MasterProfile["conflicts"][number];
  onResolve: (op: EditOp) => void;
  pending?: boolean;
}) {
  const attr = conflict.field.split(".").at(-1) ?? "";
  const isDate = attr === "start" || attr === "end";
  const [choice, setChoice] = useState<string>();
  const name = `${conflict.field}-choice`;
  return (
    <li className="py-3">
      <fieldset>
        <legend className="text-sm font-medium text-body">
          {conflictLabel(profile, conflict.field)}: {ATTRIBUTE[attr] ?? attr}
        </legend>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {conflict.values.map((v) => (
            <label
              key={`${v.value}-${v.source}`}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-2 rounded-pill border px-3 text-sm max-md:h-11",
                choice === v.value
                  ? "border-ink bg-sheet text-ink"
                  : "border-rule bg-sheet text-body hover:border-graphite",
              )}
            >
              <input
                type="radio"
                name={name}
                value={v.value}
                className="accent-[var(--ink)]"
                onChange={() => setChoice(v.value)}
              />
              <span className="font-medium">{isDate ? formatCvDate(v.value) : v.value}</span>
              <span className="text-graphite">from {SOURCE[v.source] ?? v.source}</span>
            </label>
          ))}
          <Button
            size="sm"
            variant="secondary"
            disabled={!choice || pending}
            onClick={() => choice && onResolve({ op: "resolveConflict", field: conflict.field, value: choice })}
          >
            Use this
          </Button>
        </div>
      </fieldset>
    </li>
  );
}
