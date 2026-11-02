import { ApiError, errorResponse, limitPerHour, withUser } from "@/lib/api";
import { runTailoring } from "@/lib/tailor/service";

/** Tailoring takes 10 to 30 s with lite; Vercel Hobby allows up to 300 s (checked 2026-10-30). */
export const maxDuration = 300;

/**
 * The whole request gives up after this (2026-11-02: a model request that
 * never answered held a tailoring until Vercel killed it at 300 s, and the
 * screen showed the progress steps the whole time).
 */
export const TAILOR_DEADLINE_MS = Number(process.env.TAILOR_DEADLINE_MS) || 90_000;

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
  if (jd.length > 40_000)
    throw new ApiError(400, "That post is longer than 40,000 characters. Paste only the job post.");
  limitPerHour(user.id, "tailor", 30);

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (e: TailorEvent) => {
        // A late stage from work still finishing after the deadline is dropped, not written to a closed stream.
        if (!closed) controller.enqueue(enc.encode(`${JSON.stringify(e)}\n`));
      };
      const deadline = new AbortController();
      const timer = setTimeout(
        () =>
          deadline.abort(
            new ApiError(
              504,
              `Tailoring took more than ${Math.round(TAILOR_DEADLINE_MS / 1000)} seconds and was stopped. Gemini is slow right now; try again in a minute.`,
            ),
          ),
        TAILOR_DEADLINE_MS,
      );
      // He closed the page or the connection dropped: stop as well.
      req.signal.addEventListener("abort", () => deadline.abort(new ApiError(499, "The request was closed.")));
      try {
        const stopped = new Promise<never>((_, reject) =>
          deadline.signal.addEventListener("abort", () => reject(deadline.signal.reason)),
        );
        const id = await Promise.race([
          runTailoring(user.id, jd, (stage) => send({ type: "stage", stage }), deadline.signal),
          stopped,
        ]);
        send({ type: "done", id });
      } catch (e) {
        const res = errorResponse(e);
        const { error } = (await res.json()) as { error: string };
        send({ type: "error", error, status: res.status });
      } finally {
        clearTimeout(timer);
        closed = true;
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
});
