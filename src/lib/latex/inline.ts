import type { Segment } from "@/lib/cv/document";
import { applyAccent, ACCENT_MARKS, SYMBOL_COMMANDS } from "./accents";

/**
 * Converts a fragment of CV LaTeX (one bullet, one heading argument) to plain
 * text segments, keeping \textbf spans as bold and collecting links.
 * It knows the macros in templates/resume-sample.tex and common text
 * commands; unknown commands are dropped and their arguments kept.
 */

export type InlineResult = { segments: Segment[]; links: { url: string; label: string }[] };

const DROP_WITH_ARG = new Set(["vspace", "hspace", "label", "ref", "input", "include", "color", "pdfbookmark"]);
const KEEP_ARG = new Set([
  "textit",
  "emph",
  "underline",
  "textsc",
  "textrm",
  "textsf",
  "texttt",
  "textnormal",
  "mbox",
  "text",
  "small",
  "large",
  "scshape",
  "uline",
]);
const NO_ARG_SYMBOLS: Record<string, string> = {
  textbackslash: "\\",
  textasciitilde: "~",
  textasciicircum: "^",
  textbar: "|",
  textendash: "–",
  textemdash: "–",
  textbullet: "•",
  ldots: "…",
  dots: "…",
  LaTeX: "LaTeX",
  TeX: "TeX",
  newline: "\n",
  quad: " ",
  qquad: " ",
};
const MATH: Record<string, string> = {
  "|": "|",
  "\\sim": "~",
  "\\bullet": "•",
  "\\cdot": "·",
  "\\times": "×",
  "\\approx": "≈",
  "\\geq": "≥",
  "\\leq": "≤",
  "\\to": "→",
  "\\rightarrow": "→",
  "\\%": "%",
  "+": "+",
};

/** Reads a balanced {group} starting at s[i] === "{". Returns content and the index after "}". */
export function readGroup(s: string, i: number): [string, number] {
  if (s[i] !== "{") return ["", i];
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") {
      j++;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return [s.slice(i + 1, j), j + 1];
    }
  }
  return [s.slice(i + 1), s.length];
}

function skipSpaces(s: string, i: number) {
  while (i < s.length && (s[i] === " " || s[i] === "\t" || s[i] === "\n")) i++;
  return i;
}

/** Reads one argument: a {group}, or a single following token (for \'e). */
function readArg(s: string, i: number): [string, number] {
  const j = skipSpaces(s, i);
  if (s[j] === "{") return readGroup(s, j);
  if (s[j] === "\\") {
    const m = /^\\([a-zA-Z]+)/.exec(s.slice(j));
    if (m) return [m[0], j + m[0].length];
  }
  return [s[j] ?? "", j + 1];
}

export function latexInline(src: string): InlineResult {
  const links: InlineResult["links"] = [];
  const out: Segment[] = [];

  const push = (text: string, bold: boolean) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && Boolean(last.bold) === bold) last.text += text;
    else out.push(bold ? { text, bold: true } : { text });
  };

  const walk = (s: string, bold: boolean) => {
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === "\\") {
        const next = s[i + 1];
        if (next === "\\") {
          push("\n", bold);
          i += 2;
          // Optional spacing argument after a line break: \\[4pt]
          if (s[i] === "[") i = s.indexOf("]", i) + 1 || s.length;
          continue;
        }
        if (next && "&%#$_{} ,".includes(next)) {
          push(next === "," ? " " : next, bold);
          i += 2;
          continue;
        }
        if (next && next in ACCENT_MARKS && !/[a-zA-Z]/.test(next)) {
          const [arg, j] = readArg(s, i + 2);
          const base = arg.startsWith("\\") ? (SYMBOL_COMMANDS[arg.slice(1)] ?? "") : arg;
          push(applyAccent(next, base), bold);
          i = j;
          continue;
        }
        const m = /^\\([a-zA-Z]+)\*?/.exec(s.slice(i));
        if (!m) {
          i++;
          continue;
        }
        const name = m[1];
        i += m[0].length;
        if (name.length === 1 && name in ACCENT_MARKS && ["u", "v", "H", "c", "k", "r", "d"].includes(name)) {
          const [arg, j] = readArg(s, i);
          const base = arg.startsWith("\\") ? (SYMBOL_COMMANDS[arg.slice(1)] ?? "") : arg;
          push(applyAccent(name, base), bold);
          i = j;
          continue;
        }
        if (name in SYMBOL_COMMANDS) {
          push(SYMBOL_COMMANDS[name], bold);
          if (s[i] === "{" && s[i + 1] === "}") i += 2;
          else if (s[i] === " ") i++;
          continue;
        }
        if (name in NO_ARG_SYMBOLS) {
          push(NO_ARG_SYMBOLS[name], bold);
          if (s[i] === "{" && s[i + 1] === "}") i += 2;
          continue;
        }
        if (name === "textbf" || name === "bfseries") {
          if (name === "bfseries") continue;
          const [arg, j] = readArg(s, i);
          walk(arg, true);
          i = j;
          continue;
        }
        if (name === "lnk" || name === "href") {
          const [url, j1] = readArg(s, i);
          const [label, j2] = readArg(s, j1);
          const inner = latexInline(label);
          const labelText = inner.segments.map((x) => x.text).join("");
          links.push({ url: url.replace(/\\([%#&_])/g, "$1"), label: labelText });
          links.push(...inner.links);
          for (const seg of inner.segments) push(seg.text, bold || Boolean(seg.bold));
          i = j2;
          continue;
        }
        if (name === "url") {
          const [url, j] = readArg(s, i);
          links.push({ url, label: url });
          push(url, bold);
          i = j;
          continue;
        }
        if (DROP_WITH_ARG.has(name)) {
          const [, j] = readArg(s, i);
          i = j;
          continue;
        }
        if (KEEP_ARG.has(name)) {
          const j0 = skipSpaces(s, i);
          if (s[j0] === "{") {
            const [arg, j] = readGroup(s, j0);
            walk(arg, bold);
            i = j;
            // \underline{Company}{}: swallow the trailing empty group.
            if (s.slice(i, i + 2) === "{}") i += 2;
          }
          continue;
        }
        // Unknown command: drop the name, keep whatever follows.
        continue;
      }
      if (c === "$") {
        const end = s.indexOf("$", i + 1);
        const math = (end === -1 ? s.slice(i + 1) : s.slice(i + 1, end)).trim();
        push(MATH[math] ?? math.replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, ""), bold);
        i = end === -1 ? s.length : end + 1;
        continue;
      }
      if (c === "{") {
        const [arg, j] = readGroup(s, i);
        walk(arg, bold);
        i = j;
        continue;
      }
      if (c === "}") {
        i++;
        continue;
      }
      if (c === "~") {
        push(" ", bold);
        i++;
        continue;
      }
      if (s.startsWith("---", i)) {
        // Em dashes are not allowed in output (copy rules); keep the meaning with an en dash.
        push("–", bold);
        i += 3;
        continue;
      }
      if (s.startsWith("--", i)) {
        push("–", bold);
        i += 2;
        continue;
      }
      if (s.startsWith("``", i)) {
        push("“", bold);
        i += 2;
        continue;
      }
      if (s.startsWith("''", i)) {
        push("”", bold);
        i += 2;
        continue;
      }
      push(c, bold);
      i++;
    }
  };

  walk(src, false);

  // Collapse whitespace inside each segment but keep explicit line breaks.
  const segments = out
    .map((seg) => ({ ...seg, text: seg.text.replace(/[ \t\r]*\n[ \t\r]*/g, "\n").replace(/[ \t\r]+/g, " ") }))
    .filter((seg) => seg.text.length > 0);
  if (segments.length) {
    segments[0].text = segments[0].text.replace(/^\s+/, "");
    const last = segments[segments.length - 1];
    last.text = last.text.replace(/\s+$/, "");
  }
  return { segments: segments.filter((seg) => seg.text.length > 0), links };
}

export function latexToPlain(src: string): string {
  return latexInline(src)
    .segments.map((s) => s.text)
    .join("");
}

/** Removes LaTeX comments: an unescaped % to the end of the line. */
export function stripComments(tex: string): string {
  return tex
    .split("\n")
    .map((line) => {
      for (let i = 0; i < line.length; i++) {
        if (line[i] === "\\") {
          i++;
          continue;
        }
        if (line[i] === "%") return line.slice(0, i);
      }
      return line;
    })
    .join("\n");
}
