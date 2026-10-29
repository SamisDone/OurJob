import type { Metadata } from "next";
import { ComingSoon, NeedsProfile } from "@/components/shell/page-states";
import { currentProfileStatus } from "@/lib/profile/status";

export const metadata: Metadata = { title: "Job" };

export default async function Page() {
  const status = await currentProfileStatus();
  if (status !== "confirmed") {
    return (
      <NeedsProfile title="Job" status={status}>
        Jobs are ranked against your confirmed profile, so job details start once you confirm it.
      </NeedsProfile>
    );
  }
  return <ComingSoon title="Job">Job details arrive in Phase 3, with the daily feed.</ComingSoon>;
}
