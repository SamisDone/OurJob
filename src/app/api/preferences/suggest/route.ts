import { withUser } from "@/lib/api";
import { suggestPreferences } from "@/lib/profile/service";

// P5 with the slow-model hedge can take a minute on a bad day.
export const maxDuration = 120;

/** GET: P5's suggested titles, skills and seniority on top of the draft, or null once preferences are saved. */
export const GET = withUser(async (_req, { user }) => ({ suggestion: await suggestPreferences(user.id) }));
