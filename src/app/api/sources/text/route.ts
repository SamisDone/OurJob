import { z } from "zod";
import { withUser } from "@/lib/api";
import { normalizeExtractedText } from "@/lib/ingest/text";
import { getSources, profileDb, store } from "@/lib/profile/service";

/** POST { kind: "notes" | "portfolio", text }: things his CV leaves out, or pasted portfolio text. */
export const POST = withUser(async (req, { user }) => {
  const body = z
    .object({
      kind: z.enum(["notes", "portfolio"]),
      text: z.string().trim().min(1).max(20_000),
      url: z.string().optional(),
    })
    .parse(await req.json());
  await store.saveSource(profileDb(), user.id, {
    kind: body.kind,
    text: normalizeExtractedText(body.text),
    meta: body.url ? { url: body.url, pasted: true } : { pasted: true },
  });
  return { sources: await getSources(user.id) };
});
