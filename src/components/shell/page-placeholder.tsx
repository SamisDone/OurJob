import { EmptyState } from "@/components/ui/feedback";

/** Stand-in for screens that are not built yet. Removed as each phase lands. */
export function PagePlaceholder({ title, children }: { title: string; children: string }) {
  return (
    <div className="mx-auto max-w-[1080px] px-4 pt-8 pb-16 md:px-8 lg:px-12">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <EmptyState className="mt-8" title="Not built yet.">
        {children}
      </EmptyState>
    </div>
  );
}
