import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string, exts = [".ts", ".tsx", ".css"]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p, exts);
    return exts.some((e) => p.endsWith(e)) ? [p] : [];
  });
}

const sources = files("src").map((path) => ({ path, text: readFileSync(path, "utf8") }));

const bannedWords = new RegExp(
  String.raw`\b(supercharge|unlock|elevate|seamless(ly)?|effortless(ly)?|ai-powered|magic(al)?|your journey|let's get started|lorem ipsum|john doe)\b`,
  "i",
);

describe("copy and look guard (DESIGN.md 9 and 10)", () => {
  it("has no em dashes anywhere in src", () => {
    const hits = sources.filter((f) => f.text.includes("—")).map((f) => f.path);
    expect(hits).toEqual([]);
  });

  it("uses none of the banned marketing words in components and pages", () => {
    const hits = sources
      .filter((f) => f.path.endsWith(".tsx"))
      .flatMap((f) => f.text.split("\n").map((line, i) => ({ file: f.path, line: i + 1, text: line })))
      .filter(({ text }) => bannedWords.test(text) && !/^\s*(\/\/|\*)/.test(text));
    expect(hits).toEqual([]);
  });

  it("uses one icon set, Lucide, in the migrated screens", () => {
    // Grows to all of src once every screen is on shadcn/ui and src/components/legacy is gone.
    const migrated = /[\\/](ui|shell|preview|tailor[\\/](?!desk)|jobs[\\/](?!job-row)|cv)[\\/]?/;
    const hits = sources
      .filter((f) => migrated.test(f.path) && /from\s*["']@phosphor-icons\//.test(f.text))
      .map((f) => f.path);
    expect(hits).toEqual([]);
  });

  it("loads Geist Sans and Geist Mono through next/font", () => {
    const fonts = readFileSync("src/app/fonts.ts", "utf8");
    expect(fonts).toMatch(/import\s*\{\s*Geist,\s*Geist_Mono\s*\}\s*from\s*["']next\/font\/google["']/);
  });
});
