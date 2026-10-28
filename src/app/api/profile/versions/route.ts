import { withUser } from "@/lib/api";
import { profileDb, store } from "@/lib/profile/service";

export const GET = withUser(async (_req, { user }) => ({ versions: await store.listVersions(profileDb(), user.id) }));
