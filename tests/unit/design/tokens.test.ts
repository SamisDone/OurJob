import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/design/contrast";

const css = readFileSync("src/styles/tokens.css", "utf8");

/** Hex tokens declared in the first rule whose selector starts with `selector`. */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf("{", start);
  const body = css.slice(open + 1, css.indexOf("}", open));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2].toUpperCase()]),
  );
}

const light = block(":root,");
const media = block(':root:not([data-theme="light"])');
const dark = block('[data-theme="dark"] {');

// docs/DESIGN.md section 3, Color.
const spec: Record<string, [string, string]> = {
  paper: ["#F3F5F7", "#0F1522"],
  sheet: ["#FFFFFF", "#161D2C"],
  ink: ["#1A2233", "#E6EAF0"],
  graphite: ["#5A6476", "#98A2B3"],
  rule: ["#D9DEE6", "#273046"],
  highlight: ["#F9E55A", "#E9D34A"],
  proofmark: ["#C2185B", "#F06292"],
  ok: ["#2E7D4F", "#5CC48A"],
  caution: ["#A15C00", "#F0A63C"],
};

describe("design tokens", () => {
  it("match DESIGN.md in both themes", () => {
    for (const [name, [l, d]] of Object.entries(spec)) {
      expect(light[name], `light --${name}`).toBe(l);
      expect(dark[name], `dark --${name}`).toBe(d);
    }
  });

  it("keep the OS dark theme identical to [data-theme=dark]", () => {
    expect(media).toEqual(dark);
  });

  it("pass WCAG AA for every text pair the UI uses", () => {
    for (const theme of [light, dark]) {
      for (const fg of ["ink", "graphite", "proofmark", "ok", "caution"]) {
        for (const bg of ["paper", "sheet"]) {
          expect(contrastRatio(theme[fg], theme[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrastRatio(theme.sheet, theme.ink), "primary button").toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.sheet, theme.proofmark), "destructive button").toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio("#1A2233", theme.highlight), "text on highlight").toBeGreaterThanOrEqual(4.5);
    }
  });

  it("give text fields a 3:1 edge (WCAG 1.4.11)", () => {
    for (const theme of [light, dark]) {
      for (const bg of ["paper", "sheet"]) {
        expect(contrastRatio(theme["control-edge"], theme[bg]), `control edge on ${bg}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
