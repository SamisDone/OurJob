import { ApiError, errorResponse, limitPerHour, withUser } from "@/lib/api";
import { runTailoring } from "@/lib/tailor/service";

/** Tailoring takes 10 to 60 s with the free models; Vercel Hobby allows up to 300 s (checked 2026-10-30). */
export const maxDuration = 300;

export type TailorEvent =
  | { type: "stage"; stage: "reading" | "tailoring" | "checking" }
  | { type: "done"; id: string }
  | { type: "error"; error: string; status: number };

/**
 * POST { jd }: tailors his confirmed profile to the pasted job post. The
 * response is a stream of JSON lines: one "stage" event as each step starts,
 * then "done" with the saved tailoring's id, or "error" with copy to show.
 */
export const POST = withUser(async (req, { user }) => {
  const body = (await req.json().catch(() => null)) as { jd?: unknown } | null;
  const jd = typeof body?.jd === "string" ? body.jd.trim() : "";
  if (jd.length < 80) throw new ApiError(400, "Paste the whole job post. That looks too short to tailor to.");
  if (jd.length > 40_000) throw new ApiError(400, "That post is longer than 40,000 characters. Paste only the job post.");
  limitPerHour(user.id, "tailor", 30);

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: TailorEvent) => controller.enqueue(enc.encode(`${JSON.stringify(e)}\n`));
      try {
        const id = await runTailoring(user.id, jd, (stage) => send({ type: "stage", stage }));
        send({ type: "done", id });
      } catch (e) {
        const res = errorResponse(e);
        const { error } = (await res.json()) as { error: string };
        send({ type: "error", error, status: res.status });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
});
