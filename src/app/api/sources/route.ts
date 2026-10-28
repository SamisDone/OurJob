import { z } from "zod";
import { ApiError, withUser } from "@/lib/api";
import { extractUpload, MAX_UPLOAD_BYTES } from "@/lib/ingest/files";
import { getSources, profileDb, store } from "@/lib/profile/service";

/** GET: the newest source of each kind. POST: upload a CV or LinkedIn PDF (multipart). DELETE ?kind=: forget a source. */
export const GET = withUser(async (_req, { user }) => ({ sources: await getSources(user.id) }));

export const POST = withUser(async (req, { user }) => {
  const form = await req.formData();
  const file = form.get("file");
  const linkedin = form.get("kind") === "linkedin";
  if (!(file instanceof File)) throw new ApiError(400, "Choose a file to upload.");
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, "This file is over 5 MB. Upload a smaller export.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extracted = await extractUpload(file.name, bytes, { linkedin });
  await store.saveSource(profileDb(), user.id, {
    kind: extracted.kind,
    text: extracted.text,
    filename: file.name,
    bytes,
    meta: { pages: extracted.pages ?? null, structured: Boolean(extracted.tex) },
  });
  return { sources: await getSources(user.id) };
});

const kinds = z.enum(["cv_tex", "cv_pdf", "cv_docx", "cv_md", "linkedin_pdf", "github", "portfolio", "notes"]);

export const DELETE = withUser(async (req, { user }) => {
  const kind = kinds.parse(new URL(req.url).searchParams.get("kind"));
  await store.removeSourceKind(profileDb(), user.id, kind);
  return { sources: await getSources(user.id) };
});
