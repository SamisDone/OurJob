import { z } from "zod";
import { withUser } from "@/lib/api";
import { githubToSourceText, importGitHub } from "@/lib/ingest/github";
import { getSources, profileDb, store } from "@/lib/profile/service";

/** POST { username }: imports public GitHub data as a profile source. */
export const POST = withUser(async (req, { user }) => {
  const { username } = z.object({ username: z.string().min(1).max(100) }).parse(await req.json());
  const g = await importGitHub(username);
  await store.saveSource(profileDb(), user.id, {
    kind: "github",
    text: githubToSourceText(g),
    meta: { login: g.user.login, url: g.user.url, ...g.counts },
  });
  return { counts: g.counts, login: g.user.login, sources: await getSources(user.id) };
});
