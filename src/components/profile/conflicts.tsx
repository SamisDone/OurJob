"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCvDate } from "@/lib/profile/dates";
import { conflictLabel, type EditOp } from "@/lib/profile/edit";
import type { MasterProfile } from "@/lib/profile/schema";

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
    <Alert variant="warning" role="region" aria-labelledby="conflicts-h">
      <TriangleAlert />
      <AlertTitle>
        <h2 id="conflicts-h">Your sources disagree on {n === 1 ? "one thing" : `${n} things`}</h2>
      </AlertTitle>
      <AlertDescription>
        <p>Choose the right value for each. The CV&apos;s value is used until you do.</p>
        <ul className="mt-2 w-full divide-y divide-warning/20">
          {profile.conflicts.map((c) => (
            <ConflictRow key={c.field} profile={profile} conflict={c} onResolve={onResolve} pending={pending} />
          ))}
        </ul>
      </AlertDescription>
    </Alert>
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
  const id = conflict.field.replace(/[^\w-]/g, "-");
  return (
    <li className="py-3">
      <fieldset>
        <legend className="font-medium text-foreground">
          {conflictLabel(profile, conflict.field)}: {ATTRIBUTE[attr] ?? attr}
        </legend>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <RadioGroup value={choice ?? ""} onValueChange={setChoice} className="flex flex-wrap gap-2">
            {conflict.values.map((v, i) => (
              <Label
                key={`${v.value}-${v.source}`}
                htmlFor={`${id}-${i}`}
                className="h-9 cursor-pointer rounded-lg border bg-background px-3 font-normal has-data-checked:border-ring max-md:h-11"
              >
                <RadioGroupItem id={`${id}-${i}`} value={v.value} />
                <span className="font-medium">{isDate ? formatCvDate(v.value) : v.value}</span>
                <span className="text-muted-foreground">from {SOURCE[v.source] ?? v.source}</span>
              </Label>
            ))}
          </RadioGroup>
          <Button
            variant="outline"
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
