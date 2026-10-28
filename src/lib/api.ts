import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { IngestError } from "@/lib/ingest/errors";
import { LLMError } from "@/lib/llm/types";
import { EditError } from "@/lib/profile/edit";

/**
 * Route handler wrapper: checks the session (the proxy also does, but every
 * handler re-checks), and turns known errors into JSON with copy that can be
 * shown as is. Unknown errors are logged without request bodies.
 */
export type ApiUser = { id: string; email: string; name: string | null };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Handler<C> = (req: Request, ctx: { user: ApiUser; params: C }) => Promise<Response | unknown>;

export function withUser<C = Record<string, string>>(handler: Handler<C>) {
  return async (req: Request, routeCtx: { params: Promise<C> }) => {
    const session = await auth();
    const email = session?.user?.email;
    if (!session?.user?.id || !email || !isAllowedEmail(email)) {
      return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
    }
    try {
      const out = await handler(req, {
        user: { id: session.user.id, email, name: session.user.name ?? null },
        params: await routeCtx.params,
      });
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown): Response {
  if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof IngestError) return NextResponse.json({ error: e.message, code: e.code }, { status: 422 });
  if (e instanceof EditError) return NextResponse.json({ error: e.message }, { status: 409 });
  if (e instanceof ZodError)
    return NextResponse.json({ error: "Some of that is not in the expected form." }, { status: 400 });
  if (e instanceof LLMError) {
    const status = e.code === "rate_limited" ? 429 : e.code === "auth" ? 500 : 502;
    return NextResponse.json({ error: e.message, code: e.code }, { status });
  }
  console.error("[api] unexpected error:", e instanceof Error ? `${e.name}: ${e.message}` : "unknown");
  return NextResponse.json({ error: "Something went wrong on the server. Try again." }, { status: 500 });
}

/** A per-user hourly limit for LLM routes, to protect the free quota (ARCHITECTURE 10). In memory: one instance is enough here. */
const hits = new Map<string, number[]>();
export function limitPerHour(userId: string, route: string, max: number) {
  const key = `${userId}:${route}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= max) throw new ApiError(429, `That was run ${max} times in the last hour. Try again later.`);
  recent.push(now);
  hits.set(key, recent);
}
