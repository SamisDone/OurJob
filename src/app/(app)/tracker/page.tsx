import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shell/page-placeholder";

export const metadata: Metadata = { title: "Tracker" };

export default function Page() {
  return <PagePlaceholder title="Tracker">The application tracker arrives in Phase 5.</PagePlaceholder>;
}
