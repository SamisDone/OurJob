import { z } from "zod";
import { withUser } from "@/lib/api";
import { importPortfolio } from "@/lib/ingest/portfolio";
import { getSources, profileDb, store } from "@/lib/profile/service";

/**
 * POST { url }: fetches the portfolio once through the SSRF guard. When the
 * page has little text (it renders in the browser), nothing is saved and
 * `thin` tells the UI to offer a paste box.
 */
export const POST = withUser(async (req, { user }) => {
  const { url } = z.object({ url: z.string().min(4).max(2000) }).parse(await req.json());
  const p = await importPortfolio(url);
  if (!p.thin) {
    await store.saveSource(profileDb(), user.id, {
      kind: "portfolio",
      text: p.text,
      meta: { url: p.url, title: p.title },
    });
  }
  return { thin: p.thin, chars: p.text.length, title: p.title, url: p.url, sources: await getSources(user.id) };
});
