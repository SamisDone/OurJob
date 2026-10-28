import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <h1 className="text-xl font-semibold text-ink">This page does not exist.</h1>
        <p className="mt-2 text-graphite">The link may be old, or the job may have been removed by the company.</p>
        <Link
          href="/today"
          className="mt-6 inline-block text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
        >
          Go to Today
        </Link>
      </div>
    </main>
  );
}
