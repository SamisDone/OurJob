import { withUser } from "@/lib/api";
import { searchPreferencesSchema } from "@/lib/profile/schema";
import { getOrSuggestPreferences, profileDb, store } from "@/lib/profile/service";

/** GET: saved preferences, or a first suggestion from P5. PUT: save them. */
export const GET = withUser(async (_req, { user }) => getOrSuggestPreferences(user.id));

export const PUT = withUser(async (req, { user }) => {
  const data = searchPreferencesSchema.parse(await req.json());
  return { data: await store.savePreferences(profileDb(), user.id, data), suggested: false };
});
