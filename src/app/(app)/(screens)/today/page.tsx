import type { Metadata } from "next";
import { ComingSoon, NeedsProfile } from "@/components/shell/page-states";
import { currentProfileStatus } from "@/lib/profile/status";

export const metadata: Metadata = { title: "Today" };

export default async function Page() {
  const status = await currentProfileStatus();
  if (status !== "confirmed") {
    return (
      <NeedsProfile title="Today" description="Fresh remote jobs from the last 7 days, ranked by how well they fit you." status={status}>
        Jobs are ranked against your confirmed profile, so the daily feed starts once you confirm it.
      </NeedsProfile>
    );
  }
  return (
    <ComingSoon title="Today" description="Fresh remote jobs from the last 7 days, ranked by how well they fit you.">The daily job feed arrives in Phase 3, once the job sources are in place.</ComingSoon>
  );
}
