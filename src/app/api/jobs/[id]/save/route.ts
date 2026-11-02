import { ApiError, withUser } from "@/lib/api";
import { setSaved } from "@/lib/jobs/feed";
import { profileDb } from "@/lib/profile/service";

/** POST { saved }: stars a job on Today or takes the star off. */
export const POST = withUser<{ id: string }>(async (req, { user, params }) => {
  const body = (await req.json().catch(() => null)) as { saved?: unknown } | null;
  if (typeof body?.saved !== "boolean") throw new ApiError(400, "Say whether to save the job.");
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw new ApiError(404, "That job is not in your feed.");
  if (!(await setSaved(profileDb(), user.id, params.id, body.saved)))
    throw new ApiError(404, "That job is not in your feed.");
  return { saved: body.saved };
});
