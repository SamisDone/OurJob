import { Page } from "@/components/shell/page-states";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while a page in the app loads. It also limits link prefetching to
 * this point, so the sidebar does not render every page on each page view.
 * It lives in (screens), not (app): a loading boundary starts streaming with
 * status 200, and the signed-in 404 ([...missing]) must send a real 404.
 */
export default function Loading() {
  return (
    <Page>
      <div aria-busy aria-label="Loading">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        <Card className="mt-8">
          <CardContent className="space-y-8">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
