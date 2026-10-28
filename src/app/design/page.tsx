import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { StyleTile, type Viewer } from "./style-tile";

export const metadata: Metadata = { title: "Style tile" };

async function currentViewer(): Promise<Viewer> {
  if (!process.env.AUTH_SECRET) return null;
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (!email || !isAllowedEmail(email)) return null;
    return { name: session.user.name?.trim() || email.split("@")[0], email };
  } catch {
    return null;
  }
}

/**
 * Dev-only style tile (DESIGN.md 10.3). Set ENABLE_DESIGN_TILE=1 to show it in a production build.
 * When an allowed person is signed in, their name replaces the fictional sample name.
 */
export default async function DesignPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DESIGN_TILE !== "1") notFound();
  return <StyleTile viewer={await currentViewer()} />;
}
