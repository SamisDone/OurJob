import type { Metadata } from "next";
import { ComingSoon, NeedsProfile } from "@/components/shell/page-states";
import { currentProfileStatus } from "@/lib/profile/status";

export const metadata: Metadata = { title: "Companies" };

export default async function Page() {
  const status = await currentProfileStatus();
  if (status !== "confirmed") {
    return (
      <NeedsProfile title="Companies" description="The companies whose career pages the daily search checks." status={status}>
        Companies are found for your confirmed profile and search preferences, so this list starts once you confirm it.
      </NeedsProfile>
    );
  }
  return <ComingSoon title="Companies" description="The companies whose career pages the daily search checks.">Company tracking arrives in Phase 4.</ComingSoon>;
}
