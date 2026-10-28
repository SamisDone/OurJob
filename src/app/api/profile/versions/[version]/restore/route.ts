import { ApiError, withUser } from "@/lib/api";
import { profileDb, store } from "@/lib/profile/service";

/** POST: copies an old version forward as the newest one. Nothing is deleted. */
export const POST = withUser<{ version: string }>(async (_req, { user, params }) => {
  const version = Number(params.version);
  if (!Number.isInteger(version) || version < 1) throw new ApiError(400, "That version number is not valid.");
  try {
    return { profile: await store.restoreVersion(profileDb(), user.id, version) };
  } catch {
    throw new ApiError(404, `Version ${version} does not exist.`);
  }
});
