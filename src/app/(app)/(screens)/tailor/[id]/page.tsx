import type { Metadata } from "next";
import { ComingSoon, NeedsProfile } from "@/components/shell/page-states";
import { currentProfileStatus } from "@/lib/profile/status";

export const metadata: Metadata = { title: "Tailored CV" };

export default async function Page() {
  const status = await currentProfileStatus();
  if (status !== "confirmed") {
    return (
      <NeedsProfile title="Tailored CV" status={status}>
        A tailored CV only uses facts from your confirmed profile, so tailoring starts once you confirm it.
      </NeedsProfile>
    );
  }
  return <ComingSoon title="Tailored CV">The tailoring desk arrives in Phase 2.</ComingSoon>;
}
