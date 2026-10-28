import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shell/page-placeholder";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <PagePlaceholder title="Settings">
      Settings arrive alongside the features they control, starting in Phase 1.
    </PagePlaceholder>
  );
}
