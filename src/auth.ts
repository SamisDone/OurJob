import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail } from "@/lib/auth/allowlist";

/**
 * Google sign-in with an email allowlist. Sessions are JWTs, so the proxy can
 * check them without a database call. The allowlist is checked at sign-in and
 * again on every request, so removing an email from ALLOWED_EMAILS signs that
 * person out.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  trustHost: true,
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      if (profile?.email_verified !== true) return false;
      return isAllowedEmail(profile.email);
    },
    async jwt({ token, user }) {
      // Runs with `user` only at sign-in. Create or update the users row then.
      if (user?.email) {
        const { upsertUserOnSignIn } = await import("@/lib/auth/users");
        token.uid = await upsertUserOnSignIn({ email: user.email, name: user.name, image: user.image });
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
    authorized({ auth }) {
      return Boolean(auth?.user?.email && isAllowedEmail(auth.user.email));
    },
  },
});
