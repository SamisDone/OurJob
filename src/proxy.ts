import { auth } from "@/auth";

/**
 * Optimistic auth check before every page and API route. Requests without a
 * valid session for an allowed email go to /sign-in. Pages and routes still
 * check the session themselves (see lib/auth/session.ts).
 */
export default auth;

export const config = {
  matcher: [
    // Everything except Auth.js routes, sign-in, the dev style tile, Next internals and static files.
    "/((?!api/auth|sign-in|design|_next/static|_next/image|favicon.ico|robots.txt|.*\.(?:png|jpg|jpeg|svg|webp|ico|woff2)$).*)",
  ],
};
