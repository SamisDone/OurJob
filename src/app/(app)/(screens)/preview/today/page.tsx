import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TodayPreview } from "@/components/preview/previews";

export const metadata: Metadata = { title: "Today (preview)" };

/** Dev-only: Today with fictional data. ?state=loading, empty, error or late. ENABLE_DESIGN_TILE=1 shows it in a production build. */
export default async function Page({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DESIGN_TILE !== "1") notFound();
  const { state } = await searchParams;
  return <TodayPreview state={state} />;
}
