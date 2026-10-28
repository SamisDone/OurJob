import { z } from "zod";
import { withUser } from "@/lib/api";
import { editOpSchema } from "@/lib/profile/edit";
import { editProfile, profileDb, store } from "@/lib/profile/service";

/** GET: the current profile version. PATCH { ops }: apply edits and save a new version. */
export const GET = withUser(async (_req, { user }) => ({
  profile: await store.getCurrentProfile(profileDb(), user.id),
}));

export const PATCH = withUser(async (req, { user }) => {
  const { ops } = z.object({ ops: z.array(editOpSchema).min(1).max(50) }).parse(await req.json());
  return { profile: await editProfile(user.id, ops) };
});
