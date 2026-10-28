import { limitPerHour, withUser } from "@/lib/api";
import { rebuildProfile } from "@/lib/profile/service";

/** POST: runs P1 over his sources and saves the result as a new profile version. */
export const POST = withUser(async (_req, { user }) => {
  limitPerHour(user.id, "profile-build", 10);
  return { profile: await rebuildProfile(user.id) };
});
