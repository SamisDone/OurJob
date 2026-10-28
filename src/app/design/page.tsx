import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StyleTile } from "./style-tile";

export const metadata: Metadata = { title: "Style tile" };

/** Dev-only style tile (DESIGN.md 10.3). Set ENABLE_DESIGN_TILE=1 to show it in a production build. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DESIGN_TILE !== "1") notFound();
  return <StyleTile />;
}
