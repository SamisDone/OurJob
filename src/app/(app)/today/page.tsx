import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shell/page-placeholder";

export const metadata: Metadata = { title: "Today" };

export default function Page() {
  return (
    <PagePlaceholder title="Today">
      The daily feed arrives in Phase 3, once the job sources are in place.
    </PagePlaceholder>
  );
}
