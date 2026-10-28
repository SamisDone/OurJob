import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
};

/** Plain, rule-separated table. Sentence-case headers in graphite. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-rule">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  "h-10 px-3 font-medium text-graphite first:pl-0",
                  c.align === "right" ? "text-right" : "text-left",
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-rule hover:bg-ink-wash">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "h-12 px-3 text-ink first:pl-0",
                    c.align === "right" && "text-right tabular",
                    c.className,
                  )}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
