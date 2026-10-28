import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shell/page-placeholder";

export const metadata: Metadata = { title: "Tailor" };

export default function Page() {
  return (
    <PagePlaceholder title="Tailor">
      CV tailoring arrives in Phase 2, after your profile is set up in Phase 1.
    </PagePlaceholder>
  );
}
