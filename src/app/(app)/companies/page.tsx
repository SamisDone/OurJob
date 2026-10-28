import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/shell/page-placeholder";

export const metadata: Metadata = { title: "Companies" };

export default function Page() {
  return <PagePlaceholder title="Companies">Company tracking arrives in Phase 4.</PagePlaceholder>;
}
