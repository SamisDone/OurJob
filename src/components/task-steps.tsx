import { Check } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

/**
 * Named work steps shown while something runs ("Reading the job", then
 * "Tailoring your CV"). Never a spinner on its own.
 */
export function TaskSteps({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol className="space-y-3" aria-live="polite">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-3">
          {i < current ? (
            <Check className="size-4 text-success" aria-hidden />
          ) : i === current ? (
            <Spinner className="size-4" />
          ) : (
            <span className="size-4 rounded-full border" aria-hidden />
          )}
          <span className={i > current ? "text-muted-foreground" : undefined}>
            {label}
            {i < current && <span className="sr-only">, done</span>}
            {i === current && <span className="sr-only">, in progress</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
