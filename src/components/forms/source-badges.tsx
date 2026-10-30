import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
        <Badge key={s} aria-hidden variant={s === "user_added" ? "info" : "outline"} className="font-normal">
          {SOURCE_TEXT[s] ?? s}
        </Badge>
      ))}
    </span>
  );
}
