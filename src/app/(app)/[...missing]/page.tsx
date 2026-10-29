import { notFound } from "next/navigation";

/** Any unknown address for a signed-in person: the 404 renders inside the shell (not-found.tsx here). */
export default function Page() {
  notFound();
}
