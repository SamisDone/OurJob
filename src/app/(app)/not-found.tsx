import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { PageFrame } from "@/components/shell/page-states";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/** Signed-in 404, inside the shell. The root not-found.tsx covers everyone else. */
export default function NotFound() {
  return (
    <PageFrame title="Page not found" description="There is nothing at this address.">
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestion />
          </EmptyMedia>
          <EmptyTitle>This page does not exist.</EmptyTitle>
          <EmptyDescription>The link may be old, or the job may have been removed by the company.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link href="/today">Go to Today</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </PageFrame>
  );
}
