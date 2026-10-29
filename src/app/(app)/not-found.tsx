import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageFrame } from "@/components/shell/page-states";
import { EmptyState } from "@/components/ui/feedback";

/** Signed-in 404, inside the shell. The root not-found.tsx covers everyone else. */
export default function NotFound() {
  return (
    <PageFrame title="Page not found">
      <EmptyState
        title="This page does not exist."
        action={
          <Button asChild variant="secondary">
            <Link href="/today">Go to Today</Link>
          </Button>
        }
      >
        The link may be old, or the job may have been removed by the company.
      </EmptyState>
    </PageFrame>
  );
}
