import { Badge } from "@/components/ui/badge";
import { matchLabel } from "@/lib/jobs/view";

/** "88, Strong match" in the match color: success for strong, warning for partial, neutral otherwise. */
export function MatchBadge({ fit, className }: { fit: number | null; className?: string }) {
  const m = matchLabel(fit);
  if (fit === null)
    return (
      <Badge variant="outline" className={className}>
        Not scored yet
      </Badge>
    );
  // One span, so the badge's flex gap does not split "88," from the label.
  return (
    <Badge variant={m.tone} className={className}>
      <span>
        <span className="num">{fit}</span>, {m.label}
      </span>
    </Badge>
  );
}
