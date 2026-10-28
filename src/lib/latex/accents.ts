/**
 * LaTeX accent and symbol commands for Latin letters, usable with the
 * template's default OT1 encoding (no fontenc). Used both ways: the .tex
 * importer decodes commands to Unicode, and escapeLatex() encodes Unicode
 * letters to commands. See DECISIONS.md, "Font encoding".
 */

/** Accent command (the character after the backslash) to its combining mark. */
export const ACCENT_MARKS: Record<string, string> = {
  "'": "́", // acute
  "`": "̀", // grave
  "^": "̂", // circumflex
  '"': "̈", // diaeresis
  "~": "̃", // tilde
  "=": "̄", // macron
  ".": "̇", // dot above
  u: "̆", // breve
  v: "̌", // caron
  H: "̋", // double acute
  c: "̧", // cedilla
  k: "̨", // ogonek
  r: "̊", // ring above
  d: "̣", // dot below
};

/** Letters and ligatures that have their own command rather than an accent. */
export const SYMBOL_COMMANDS: Record<string, string> = {
  ss: "ß",
  o: "ø",
  O: "Ø",
  l: "ł",
  L: "Ł",
  aa: "å",
  AA: "Å",
  ae: "æ",
  AE: "Æ",
  oe: "œ",
  OE: "Œ",
  i: "ı",
  j: "ȷ",
  DH: "Ð",
  dh: "ð",
  TH: "Þ",
  th: "þ",
};

/** Applies an accent command to a base letter: ("'", "e") gives "é". Dotless i and j become i and j. */
export function applyAccent(command: string, base: string): string {
  const mark = ACCENT_MARKS[command];
  const letter = base === "ı" ? "i" : base === "ȷ" ? "j" : base;
  if (!mark) return letter;
  return (letter + mark).normalize("NFC");
}

const MARK_TO_COMMAND = Object.fromEntries(Object.entries(ACCENT_MARKS).map(([cmd, mark]) => [mark, cmd]));
const SYMBOL_TO_COMMAND = Object.fromEntries(Object.entries(SYMBOL_COMMANDS).map(([cmd, ch]) => [ch, cmd]));

/**
 * Encodes one Unicode character as a LaTeX command, or returns null when no
 * OT1-safe command exists (for example Bangla script).
 */
export function encodeLatinChar(ch: string): string | null {
  if (SYMBOL_TO_COMMAND[ch] && ch !== "ı" && ch !== "ȷ") return `\\${SYMBOL_TO_COMMAND[ch]}{}`;
  const decomposed = ch.normalize("NFD");
  const base = decomposed[0];
  const marks = [...decomposed.slice(1)];
  if (!/^[A-Za-z]$/.test(base) || marks.length === 0) return null;
  let out = base === "i" ? "\\i" : base === "j" ? "\\j" : base;
  // Only dotted i and j lose their dot under an accent above.
  if (out.startsWith("\\") && marks.some((m) => ["̣", "̧", "̨"].includes(m))) out = base;
  for (const mark of marks) {
    const cmd = MARK_TO_COMMAND[mark];
    if (!cmd) return null;
    out = `\\${cmd}{${out}}`;
  }
  return out;
}
