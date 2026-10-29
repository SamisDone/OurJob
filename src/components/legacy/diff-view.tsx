import { cn } from "@/lib/utils";

export type DiffItem =
  | { kind: "rewritten"; where: string; before: string; after: string }
  | { kind: "moved"; where: string; text: string; note: string }
  | { kind: "dropped"; where: string; text: string; reason?: string }
  | { kind: "kept"; where: string; text: string };

const label: Record<DiffItem["kind"], string> = {
  rewritten: "Rewritten",
  moved: "Moved",
  dropped: "Left out",
  kept: "Kept",
};

/** Changes versus the master CV. Old wording struck through in graphite, new in ink. */
export function DiffView({ items, className }: { items: DiffItem[]; className?: string }) {
  return (
    <ol className={cn("divide-y divide-rule border-y border-rule", className)}>
      {items.map((item, i) => (
        <li key={i} className="grid gap-x-6 gap-y-1 py-3.5 md:grid-cols-[132px_1fr]">
          <div className="text-sm">
            <span className={cn("font-medium", item.kind === "dropped" ? "text-graphite" : "text-body")}>
              {label[item.kind]}
            </span>
            <span className="block text-xs text-graphite">{item.where}</span>
          </div>
          <div className="space-y-1.5 text-sm">
            {item.kind === "rewritten" && (
              <>
                <del className="block text-graphite decoration-graphite/70">
                  <span className="sr-only">Before: </span>
                  {item.before}
                </del>
                <ins className="block text-body no-underline">
                  <span className="sr-only">After: </span>
                  {item.after}
                </ins>
              </>
            )}
            {item.kind === "moved" && (
              <>
                <p className="text-body">{item.text}</p>
                <p className="text-xs text-graphite">{item.note}</p>
              </>
            )}
            {item.kind === "dropped" && (
              <>
                <p className="text-graphite line-through decoration-graphite/70">{item.text}</p>
                {item.reason && <p className="text-xs text-graphite">{item.reason}</p>}
              </>
            )}
            {item.kind === "kept" && <p className="text-body">{item.text}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
