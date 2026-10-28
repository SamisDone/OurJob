import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PagePlaceholder } from "@/components/shell/page-placeholder";
import { requireUser } from "@/lib/auth/session";
import { getCurrentProfile } from "@/lib/profile/store";
import { profileDb } from "@/lib/profile/service";

export const metadata: Metadata = { title: "Today" };

export default async function Page() {
  const user = await requireUser();
  // Until he has confirmed a profile, the next useful thing is onboarding.
  const profile = await getCurrentProfile(profileDb(), user.id);
  if (!profile?.confirmedAt) redirect("/onboarding");
  return (
    <PagePlaceholder title="Today">
      The daily feed arrives in Phase 3, once the job sources are in place.
    </PagePlaceholder>
  );
}
