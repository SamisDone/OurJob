import type { Metadata } from "next";
import { ComingSoon, NeedsProfile } from "@/components/shell/page-states";
import { currentProfileStatus } from "@/lib/profile/status";

export const metadata: Metadata = { title: "Tracker" };

export default async function Page() {
  const status = await currentProfileStatus();
  if (status !== "confirmed") {
    return (
      <NeedsProfile title="Tracker" description="Jobs you saved and applied to, from first look to offer." status={status}>
        The tracker holds jobs you save and apply to, which starts once you confirm your profile.
      </NeedsProfile>
    );
  }
  return <ComingSoon title="Tracker" description="Jobs you saved and applied to, from first look to offer.">The application tracker arrives in Phase 5.</ComingSoon>;
}
