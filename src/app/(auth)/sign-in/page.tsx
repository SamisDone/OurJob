import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";
import { isAllowedEmail } from "@/lib/auth/allowlist";

export const metadata: Metadata = { title: "Sign in" };

const errorCopy: Record<string, string> = {
  AccessDenied: "This account is not on the allowlist for this deployment. Ask the owner to add your email.",
  Configuration:
    "Google sign-in is not set up on this deployment yet. The owner needs to add AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET.",
};

function googleConfigured() {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string; signedOut?: string }>;
}) {
  const { error, callbackUrl, signedOut } = await searchParams;

  if (googleConfigured()) {
    const session = await auth();
    if (session?.user?.email && isAllowedEmail(session.user.email)) redirect("/today");
  }

  const message = error
    ? (errorCopy[error] ?? "Sign-in did not finish. Try again.")
    : googleConfigured()
      ? null
      : errorCopy.Configuration;

  // Auth.js only follows same-origin redirects, so the callback URL is safe to pass on.
  const redirectTo = callbackUrl ?? "/today";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="w-full max-w-[400px]">
        <Wordmark />
        <h1 className="mt-6 text-2xl font-semibold text-ink">Sign in</h1>
        <p className="mt-2 text-base text-graphite">Tailored CVs and fresh remote jobs, every morning.</p>

        <form
          className="mt-8"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo });
          }}
        >
          <Button type="submit" className="w-full" disabled={!googleConfigured()}>
            Continue with Google
          </Button>
        </form>

        {signedOut && !message && (
          <p role="status" className="mt-5 text-sm text-graphite">
            Signed out.
          </p>
        )}

        {message && (
          <p role="alert" className="mt-5 border-l-2 border-redpen py-1 pl-3 text-sm text-body">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
