"use client";

import { ShieldAlert } from "lucide-react";
import { LoadError } from "@/components/load-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useAiSettings, useSaveTailorModel } from "@/lib/query/settings";

/** Measured in pnpm eval:tailor on ten fictional job posts (DECISIONS.md, 2026-10-29). */
const TIER_NOTE = {
  standard: "Used for everything. A tailored CV takes about 15 seconds.",
  thorough:
    "Writes your tailored CVs; the job post is still read by the standard model. Google's free tier allows a few CVs a day with it, then Standard takes over.",
} as const;

export function AiSection() {
  const q = useAiSettings();
  const save = useSaveTailorModel();

  if (q.isPending) {
    return (
      <div aria-busy className="space-y-3">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <LoadError title="The AI settings did not load." onRetry={() => void q.refetch()}>
        {q.error.message}
      </LoadError>
    );
  }

  const { models, tailorModel } = q.data;
  const current = models.thorough ? tailorModel : "standard";
  return (
    <div className="space-y-4">
      {models.thorough ? (
        <FieldSet>
          <FieldLegend variant="label">Model for tailoring</FieldLegend>
          <RadioGroup
            aria-label="Model for tailoring"
            value={current}
            onValueChange={(v) => save.mutate(v as "standard" | "thorough")}
            className="grid gap-3 sm:grid-cols-2"
          >
            {(["standard", "thorough"] as const).map((tier) => (
              <FieldLabel key={tier} htmlFor={`tier-${tier}`}>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>{tier === "standard" ? "Standard" : "Thorough"}</FieldTitle>
                    <FieldDescription>
                      {models[tier]}. {TIER_NOTE[tier]}
                    </FieldDescription>
                  </FieldContent>
                  <RadioGroupItem value={tier} id={`tier-${tier}`} />
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
          {save.isError && <LoadError title="The model choice was not saved.">{save.error.message}</LoadError>}
        </FieldSet>
      ) : (
        <p>
          Gemini, model <span className="font-medium">{models.standard}</span>.
        </p>
      )}
      <Alert>
        <ShieldAlert />
        <AlertDescription>
          On Gemini&apos;s free tier, Google can use what you send to improve its products. Use a paid key or another
          provider if you would rather it did not.
        </AlertDescription>
      </Alert>
    </div>
  );
}
