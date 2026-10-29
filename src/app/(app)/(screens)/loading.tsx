import { Skeleton } from "@/components/ui/feedback";

/**
 * Shown while a page in the app loads. It also limits link prefetching to
 * this point, so the rail does not render every page on each page view.
 * It lives in (screens), not (app): a loading boundary starts streaming with
 * status 200, and the signed-in 404 ([...missing]) must send a real 404.
 */
export default function Loading() {
  return (
    <div aria-busy aria-label="Loading" className="mx-auto max-w-[920px] px-4 pt-8 pb-16 md:px-8">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      <div className="mt-8 rounded-panel border border-rule bg-sheet px-5 py-8 md:px-10">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="mb-8 space-y-2 last:mb-0">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}
