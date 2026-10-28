import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shell/page-placeholder";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return <PagePlaceholder title="Profile">The profile editor arrives in Phase 1.</PagePlaceholder>;
}
