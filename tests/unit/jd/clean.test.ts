import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanJobText } from "@/lib/jd/clean";

describe("cleanJobText", () => {
  const messy = readFileSync("tests/fixtures/jds/07-messy-paste-courierly.txt", "utf8");
  const clean = cleanJobText(messy);

  it("drops page chrome from a select-all paste", () => {
    for (const junk of [
      "Skip to main content",
      "Accept all cookies",
      "We use cookies",
      "Apply now",
      "Save job",
      "Powered by Workable",
      "Facebook",
    ]) {
      expect(clean, junk).not.toContain(junk);
    }
  });

  it("keeps the post and only the first copy of repeated lines", () => {
    expect(clean).toContain("Build and scale routing and pricing services in Go");
    expect(clean.match(/Senior Software Engineer, Routing \(Go\)/g)).toHaveLength(1);
  });

  it("normalizes whitespace, quotes and invisible characters", () => {
    expect(cleanJobText("Go​ and Kafka\r\n\r\n\r\nIt’s  remote")).toBe("Go and Kafka\n\nIt's remote");
  });
});
