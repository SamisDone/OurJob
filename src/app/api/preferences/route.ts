import { withUser } from "@/lib/api";
import { searchPreferencesSchema } from "@/lib/profile/schema";
import { getPreferencesOrDraft, profileDb, store } from "@/lib/profile/service";

/** GET: saved preferences, or a draft from the profile (instant; P5 is /api/preferences/suggest). PUT: save them. */
export const GET = withUser(async (_req, { user }) => getPreferencesOrDraft(user.id));

export const PUT = withUser(async (req, { user }) => {
  const data = searchPreferencesSchema.parse(await req.json());
  return { data: await store.savePreferences(profileDb(), user.id, data), suggested: false };
});
