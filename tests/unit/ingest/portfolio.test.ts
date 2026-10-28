import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractMainText } from "@/lib/ingest/portfolio";
import { visibleCharCount } from "@/lib/ingest/text";

describe("extractMainText", () => {
  const html = readFileSync("tests/fixtures/sources/portfolio/tomas-herrera.html", "utf8");
  const r = extractMainText(html, "https://example.org/tomas");

  it("keeps the article and drops scripts and styles", () => {
    expect(r.text).toContain("React and TypeScript on the front");
    expect(r.text).toContain("Feria");
    expect(r.text).not.toContain("window.analytics");
    expect(r.text).not.toContain("font-family");
  });

  it("collects absolute links with labels, without duplicates", () => {
    expect(r.links).toContainEqual({ label: "Source on GitHub", url: "https://github.com/example-tomas/feria" });
    expect(r.links).toContainEqual({ label: "Work", url: "https://example.org/work" });
    expect(r.links.filter((l) => l.url === "https://example.org/feria")).toHaveLength(1);
    expect(r.links.some((l) => l.url.startsWith("mailto:"))).toBe(false);
  });

  it("returns little text for a page that renders in the browser", () => {
    const spa =
      '<html><head><title>Portfolio</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
    expect(visibleCharCount(extractMainText(spa, "https://example.org/").text)).toBeLessThan(300);
  });
});
