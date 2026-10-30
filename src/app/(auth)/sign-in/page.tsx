import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { LogoMark } from "@/components/shell/wordmark";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted px-6 py-16">
      <div className="flex items-center gap-2 font-semibold">
        <LogoMark />
        OurJob
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>
            <h1 className="text-xl">Sign in</h1>
          </CardTitle>
          <CardDescription>Tailored CVs and fresh remote jobs, every morning.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo });
            }}
          >
            <Button type="submit" size="lg" className="w-full" disabled={!googleConfigured()}>
              Continue with Google
            </Button>
          </form>

          {signedOut && !message && (
            <p role="status" className="text-center text-sm text-muted-foreground">
              Signed out.
            </p>
          )}

          {message && (
            <Alert variant="destructive" role="alert">
              <CircleAlert />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
