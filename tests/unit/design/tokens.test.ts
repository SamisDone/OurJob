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

// docs/DESIGN.md section 3, Color ("index card and ballpoint").
// --control-edge light is #6F7EA5, one step darker than the brief's #7685AE,
// which measured 2.88:1 on --paper (see DECISIONS.md).
const spec: Record<string, [string, string]> = {
  paper: ["#E6E4DF", "#10162A"],
  sheet: ["#FFFFFF", "#182039"],
  ink: ["#1F3A93", "#DCE4F7"],
  body: ["#2A3145", "#C9D0E0"],
  graphite: ["#4F5D80", "#9AA6C4"],
  rule: ["#C9D8F0", "#2A3557"],
  "control-edge": ["#6F7EA5", "#6878A6"],
  "red-rule": ["#D7263D", "#FF6B7A"],
  redpen: ["#C41E3A", "#FF6B7A"],
  "circle-fill": ["#DCE6FA", "#2A3A6E"],
  "circle-stroke": ["#1F3A93", "#8FB0FF"],
  ok: ["#186A41", "#5CC48A"],
  caution: ["#8A5100", "#F0A63C"],
};

const TEXT = ["ink", "body", "graphite", "redpen", "ok", "caution"];
const SURFACES = ["paper", "sheet"];

describe("design tokens", () => {
  it("match DESIGN.md in both themes", () => {
    for (const [name, [l, d]] of Object.entries(spec)) {
      expect(light[name], `light --${name}`).toBe(l);
      expect(dark[name], `dark --${name}`).toBe(d);
    }
  });

  it("no longer define the highlighter or proofmark", () => {
    expect(css).not.toMatch(/--(highlight|proofmark)/);
  });

  it("keep the OS dark theme identical to [data-theme=dark]", () => {
    expect(media).toEqual(dark);
  });

  it("pass WCAG AA (4.5:1) for every text color on paper and sheet", () => {
    for (const [name, theme] of [
      ["light", light],
      ["dark", dark],
    ] as const) {
      for (const fg of TEXT) {
        for (const bg of SURFACES) {
          expect(contrastRatio(theme[fg], theme[bg]), `${name}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("pass AA for circled words, buttons and the focus ring", () => {
    for (const [name, theme] of [
      ["light", light],
      ["dark", dark],
    ] as const) {
      // A circled keyword keeps --body text on --circle-fill.
      expect(contrastRatio(theme.body, theme["circle-fill"]), `${name}: body on circle-fill`).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrastRatio(theme.ink, theme["circle-fill"]), `${name}: ink on circle-fill`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.sheet, theme.ink), `${name}: primary button`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.sheet, theme.redpen), `${name}: destructive button`).toBeGreaterThanOrEqual(4.5);
      // Non-text marks need 3:1 against what they sit on (WCAG 1.4.11).
      expect(contrastRatio(theme["circle-stroke"], theme.sheet), `${name}: pen circle on sheet`).toBeGreaterThanOrEqual(
        3,
      );
      expect(
        contrastRatio(theme["circle-stroke"], theme["circle-fill"]),
        `${name}: pen circle on fill`,
      ).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(theme.redpen, theme.sheet), `${name}: red underline`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(theme.ink, theme.paper), `${name}: focus outline`).toBeGreaterThanOrEqual(3);
    }
  });

  it("give text fields a 3:1 edge on paper and sheet (WCAG 1.4.11)", () => {
    for (const [name, theme] of [
      ["light", light],
      ["dark", dark],
    ] as const) {
      for (const bg of SURFACES) {
        expect(
          contrastRatio(theme["control-edge"], theme[bg]),
          `${name}: control edge on ${bg}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
