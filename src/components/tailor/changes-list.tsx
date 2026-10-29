import { Badge } from "@/components/ui/badge";
import type { SampleChange } from "@/lib/design/sample";

export type CvChange = SampleChange;

const kindLabel: Record<CvChange["kind"], string> = {
  rewritten: "Reworded",
  moved: "Moved",
  dropped: "Left out",
};

/** What tailoring changed versus the master CV: reworded, moved, left out. */
export function ChangesList({ changes }: { changes: CvChange[] }) {
  return (
    <ol className="divide-y rounded-lg border">
      {changes.map((c, i) => (
        <li key={i} className="space-y-2 p-4">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">{kindLabel[c.kind]}</Badge>
            <span className="text-muted-foreground">{c.where}</span>
          </div>
          {c.kind === "rewritten" && (
            <div className="grid gap-2 md:grid-cols-2 md:gap-4">
              <p className="text-muted-foreground line-through decoration-muted-foreground/60">
                <span className="sr-only">Before: </span>
                {c.before}
              </p>
              <p>
                <span className="sr-only">After: </span>
                {c.after}
              </p>
            </div>
          )}
          {c.kind === "moved" && (
            <>
              <p>{c.text}</p>
              <p className="text-sm text-muted-foreground">{c.note}</p>
            </>
          )}
          {c.kind === "dropped" && (
            <>
              <p className="text-muted-foreground line-through decoration-muted-foreground/60">{c.text}</p>
              <p className="text-sm text-muted-foreground">{c.reason}</p>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
