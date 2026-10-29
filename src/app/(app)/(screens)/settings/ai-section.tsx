"use client";

import { Callout, ErrorState, Skeleton } from "@/components/legacy/feedback";
import { Segmented } from "@/components/legacy/tabs";
import { useAiSettings, useSaveTailorModel } from "@/lib/query/settings";

/** Measured in pnpm eval:tailor on ten fictional job posts (DECISIONS.md, 2026-10-29). */
const TIER_NOTE = {
  standard: "Used for everything. A tailored CV takes about 15 seconds.",
  thorough: "Used for tailoring only. Rewords more, and takes longer.",
} as const;

export function AiSection() {
  const q = useAiSettings();
  const save = useSaveTailorModel();

  if (q.isPending) {
    return (
      <div aria-busy className="space-y-3">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-9 w-56" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <ErrorState title="The AI settings did not load." onRetry={() => void q.refetch()}>
        {q.error.message}
      </ErrorState>
    );
  }

  const { models, tailorModel } = q.data;
  const current = models.thorough ? tailorModel : "standard";
  return (
    <div>
      {models.thorough ? (
        <>
          <p id="tailor-model" className="font-medium text-ink">
            Model for tailoring
          </p>
          <Segmented
            className="mt-3"
            aria-label="Model for tailoring"
            value={current}
            onValueChange={(v) => save.mutate(v as "standard" | "thorough")}
            options={[
              { value: "standard", label: "Standard" },
              { value: "thorough", label: "Thorough" },
            ]}
          />
          <p className="mt-2 text-sm text-graphite" aria-live="polite">
            Gemini {current === "thorough" ? models.thorough : models.standard}. {TIER_NOTE[current]}
          </p>
          {save.isError && (
            <p role="alert" className="mt-2 text-sm text-redpen">
              {save.error.message}
            </p>
          )}
        </>
      ) : (
        <p className="text-body">
          Gemini, model <span className="font-medium">{models.standard}</span>.
        </p>
      )}
      <Callout className="mt-4">
        On Gemini&apos;s free tier, Google can use what you send to improve its products. Use a paid key or another
        provider if you would rather it did not.
      </Callout>
    </div>
  );
}
