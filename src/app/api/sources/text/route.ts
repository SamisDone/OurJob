import { z } from "zod";
import { withUser } from "@/lib/api";
import { normalizeExtractedText } from "@/lib/ingest/text";
import { getSources, profileDb, store } from "@/lib/profile/service";

/** POST { kind: "notes" | "portfolio" | "cv", text }: notes, pasted portfolio text, or a pasted CV. */
export const POST = withUser(async (req, { user }) => {
  const body = z
    .object({
      kind: z.enum(["notes", "portfolio", "cv"]),
      text: z.string().trim().min(1).max(20_000),
      url: z.string().optional(),
    })
    .parse(await req.json());
  await store.saveSource(profileDb(), user.id, {
    // A pasted CV is stored as Markdown text, like an uploaded .md file.
    kind: body.kind === "cv" ? "cv_md" : body.kind,
    filename: body.kind === "cv" ? "Pasted text" : undefined,
    text: normalizeExtractedText(body.text),
    meta: body.url ? { url: body.url, pasted: true } : { pasted: true },
  });
  return { sources: await getSources(user.id) };
});
