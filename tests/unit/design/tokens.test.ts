import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/design/contrast";

const css = readFileSync("src/app/globals.css", "utf8");

/** Hex tokens declared in the first rule whose selector is exactly `selector`. */
function block(selector: string): Record<string, string> {
  const start = css.search(new RegExp(`^${selector.replace(".", "\\.")} \\{`, "m"));
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf("{", start);
  const body = css.slice(open + 1, css.indexOf("}", open));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2].toUpperCase()]),
  );
}

const light = block(":root");
const dark = block(".dark");

// docs/DESIGN.md section 3: the four status colors, as [text, soft background].
const spec: Record<string, { light: [string, string]; dark: [string, string] }> = {
  success: { light: ["#107D32", "#E9F7EE"], dark: ["#3FCF6E", "#0F2A19"] },
  warning: { light: ["#A35200", "#FFF4E0"], dark: ["#F5A524", "#2E2008"] },
  destructive: { light: ["#C4232E", "#FDECEC"], dark: ["#FF6369", "#3A1416"] },
  info: { light: ["#0062CC", "#EAF3FF"], dark: ["#52A8FF", "#0B2340"] },
};

// The neutral backgrounds they sit on: background and card. oklch(1 0 0) is
// white; oklch(0.145 0 0) and oklch(0.205 0 0) are the dark background and card.
const SURFACES = { light: ["#FFFFFF"], dark: ["#0A0A0A", "#171717"] };

describe("status colors", () => {
  it("match DESIGN.md in both themes", () => {
    for (const [name, s] of Object.entries(spec)) {
      expect([light[name], light[`${name}-soft`]], `light --${name}`).toEqual(s.light);
      expect([dark[name], dark[`${name}-soft`]], `dark --${name}`).toEqual(s.dark);
    }
  });

  it("pass WCAG AA (4.5:1) as text on their soft background", () => {
    for (const [name, s] of Object.entries(spec)) {
      for (const theme of ["light", "dark"] as const) {
        const [fg, bg] = s[theme];
        expect(contrastRatio(fg, bg), `${theme}: ${name} on ${name}-soft`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("pass WCAG AA as text on the page and card backgrounds", () => {
    for (const [name, s] of Object.entries(spec)) {
      for (const theme of ["light", "dark"] as const) {
        for (const bg of SURFACES[theme]) {
          expect(contrastRatio(s[theme][0], bg), `${theme}: ${name} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("use info for the focus ring", () => {
    expect(css).toMatch(/--ring: var\(--info\);/);
  });
});
