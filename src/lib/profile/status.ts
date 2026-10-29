import "server-only";
import { requireUser } from "@/lib/auth/session";
import { profileDb } from "./service";
import { getCurrentProfile } from "./store";

/** none: no profile built yet. draft: built but not confirmed. confirmed: tailoring and the feed may use it. */
export type ProfileStatus = "none" | "draft" | "confirmed";

export async function currentProfileStatus(): Promise<ProfileStatus> {
  const user = await requireUser();
  const profile = await getCurrentProfile(profileDb(), user.id);
  if (!profile) return "none";
  return profile.confirmedAt ? "confirmed" : "draft";
}
