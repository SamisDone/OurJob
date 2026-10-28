import { ApiError, withUser } from "@/lib/api";
import { profileDb, store } from "@/lib/profile/service";

/** POST: he has reviewed the profile; it can now be used for tailoring. */
export const POST = withUser(async (_req, { user }) => {
  const current = await store.getCurrentProfile(profileDb(), user.id);
  if (!current) throw new ApiError(404, "There is no profile to confirm yet.");
  if (current.data.conflicts.length > 0) throw new ApiError(409, "Resolve the conflicts first.");
  await store.confirmProfile(profileDb(), user.id);
  return { profile: await store.getCurrentProfile(profileDb(), user.id) };
});
