"use client";

import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Bookmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPay, formatPosted, type FeedJob } from "@/lib/jobs/view";
import { cn } from "@/lib/utils";
import { Nums } from "@/components/nums";
import { MatchBadge } from "./match-badge";

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() });
const helper = createColumnHelper<typeof features, FeedJob>();

const time = (iso: string | null) => (iso ? Date.parse(iso) : undefined);
const payValue = (j: FeedJob) => (j.pay ? (j.pay.max ?? j.pay.min) : undefined);

/** Match, pay and posted move under the title on phones, so the table fits 390 px. */
const PHONE_HIDDEN = new Set(["match", "pay", "posted"]);

/**
 * The Today table: role and company, match, pay per year, posted. Clicking a
 * row (or its title, for keyboard users) opens the job in a sheet.
 */
export function JobsTable({
  jobs,
  now,
  selectedId,
  onOpen,
}: {
  jobs: FeedJob[];
  now: Date;
  selectedId?: string | null;
  onOpen: (job: FeedJob) => void;
}) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("title", {
          id: "role",
          header: "Role and company",
          enableSorting: false,
          cell: ({ row }) => {
            const j = row.original;
            return (
              <div className="flex min-w-0 flex-col gap-1 py-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(j);
                    }}
                    className="text-left text-[15px] font-medium outline-none hover:underline focus-visible:underline"
                  >
                    {j.title}
                  </button>
                  {j.isNew && <Badge variant="info">New</Badge>}
                  {j.saved && (
                    <Bookmark className="size-3.5 shrink-0 fill-current text-muted-foreground" aria-label="Saved" />
                  )}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <span>{j.company}</span>
                  {j.newCompany && <Badge variant="outline">New company</Badge>}
                </div>
                {/* Phones: match, pay and posted under the title. */}
                <div className="mt-1 flex flex-col items-start gap-1.5 text-sm text-muted-foreground md:hidden">
                  <MatchBadge fit={j.fit} />
                  <span>
                    <Nums>{formatPay(j.pay)}</Nums>, <Nums>{formatPosted(j.postedAt, now).toLowerCase()}</Nums>
                  </span>
                </div>
              </div>
            );
          },
        }),
        helper.accessor((j) => j.fit ?? undefined, {
          id: "match",
          header: "Match",
          sortUndefined: "last",
          cell: ({ row }) => <MatchBadge fit={row.original.fit} />,
        }),
        helper.accessor(payValue, {
          id: "pay",
          header: "Pay per year",
          sortUndefined: "last",
          cell: ({ row }) => (
            <span className={cn(!row.original.pay && "text-muted-foreground")}>
              <Nums>{formatPay(row.original.pay)}</Nums>
            </span>
          ),
        }),
        helper.accessor((j) => time(j.postedAt), {
          id: "posted",
          header: "Posted",
          sortUndefined: "last",
          cell: ({ row }) => (
            <time
              dateTime={row.original.postedAt ?? undefined}
              className={cn(!row.original.postedAt && "text-muted-foreground")}
            >
              <Nums>{formatPosted(row.original.postedAt, now)}</Nums>
            </time>
          ),
        }),
      ]),
    [now, onOpen],
  );

  const table = useTable({
    features,
    columns,
    data: jobs,
    getRowId: (j) => j.id,
    initialState: { sorting: [{ id: "match", desc: true }] },
    enableSortingRemoval: false,
  });

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table className="text-sm">
        <TableHeader className="bg-muted/50">
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    className={cn(
                      "h-11 px-4 text-muted-foreground",
                      PHONE_HIDDEN.has(header.column.id) && "hidden md:table-cell",
                      header.column.id === "role" && "w-full",
                    )}
                  >
                    {header.column.getCanSort() ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2.5 font-medium text-muted-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <table.FlexRender header={header} />
                        {sorted === "asc" ? <ArrowUp /> : sorted === "desc" ? <ArrowDown /> : <ArrowUpDown />}
                      </Button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.id === selectedId ? "selected" : undefined}
              onClick={() => onOpen(row.original)}
              className="cursor-pointer"
            >
              {row.getAllCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    "h-14 px-4",
                    PHONE_HIDDEN.has(cell.column.id) && "hidden md:table-cell",
                    cell.column.id === "role" && "max-w-0 whitespace-normal",
                  )}
                >
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
