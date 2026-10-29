import type { Metadata } from "next";
import { ComingSoon, NeedsProfile } from "@/components/shell/page-states";
import { currentProfileStatus } from "@/lib/profile/status";

export const metadata: Metadata = { title: "Tailor" };

export default async function Page() {
  const status = await currentProfileStatus();
  if (status !== "confirmed") {
    return (
      <NeedsProfile title="Tailor" description="Paste a job post and get your CV rewritten for it, ready to open in Overleaf." status={status}>
        A tailored CV only uses facts from your confirmed profile, so tailoring starts once you confirm it.
      </NeedsProfile>
    );
  }
  return <ComingSoon title="Tailor" description="Paste a job post and get your CV rewritten for it, ready to open in Overleaf.">CV tailoring arrives in Phase 2.</ComingSoon>;
}
