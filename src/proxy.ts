import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth/allowlist";

/**
 * Optimistic auth check before every page and API route: the session token
 * must decode and its email must be on ALLOWED_EMAILS. Pages and route
 * handlers check again themselves (lib/auth/session.ts, lib/api.ts).
 *
 * This reads the token and never re-issues the cookie. Auth.js's own proxy
 * wrapper refreshes the cookie on every request, so a link prefetch that
 * finished just after sign-out could set it again and quietly sign him back
 * in. Sessions therefore last a fixed 30 days from sign-in (DECISIONS.md).
 */
export default async function proxy(req: NextRequest) {
  // Behind Vercel's TLS proxy Auth.js names the cookie from the forwarded
  // protocol (trustHost), so read the same header here.
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
  let email: string | null | undefined;
  try {
    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET ?? "",
      secureCookie: secure,
      salt: cookieName,
      cookieName,
    });
    email = token?.email;
  } catch {
    email = null;
  }
  if (email && isAllowedEmail(email)) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }
  const signIn = new URL("/sign-in", req.url);
  signIn.searchParams.set("callbackUrl", `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: [
    // Everything except Auth.js routes, sign-in, the dev style tile, Next internals and static files.
    "/((?!api/auth|sign-in|design|_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2)$).*)",
  ],
};
