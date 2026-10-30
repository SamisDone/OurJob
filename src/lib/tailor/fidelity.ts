import { mentions } from "@/lib/profile/skills";
import { extractNumbers, unsupportedReason } from "./numbers";

/**
 * Bullet fidelity (docs/AI_PROMPTS.md, validator checks 2c and 2d). A
 * tailored bullet may reorder, trim filler and reword, but:
 *  - it keeps the details its source bullet states: numbers, parentheses,
 *    named tools, possessives, and every word the job post also uses
 *    ("three-role access on Firebase Auth" may not lose "Auth" when the job
 *    asks for auth);
 *  - it adds no detail its own source bullets do not state: no number and no
 *    tool pulled in from the role's tech line or another bullet ("68 tests
 *    run in CI on PHP 8.1 to 8.4 using PostgreSQL").
 * When a single-source bullet breaks either rule, the validator puts the
 * source bullet's own text back: his words are always true, and no model call
 * is needed.
 */

const STOP = new Set(
  (
    "a an and are as at be been but by can for from had has have he her his i if in into is it its me my of on or our " +
    "she so than that the their them then there these they this those to too up us was we were what when where which " +
    "while who will with within without you your also any all each more most other some such via using used use per " +
    "over under across through about after before during between both only very just new well work worked working"
  ).split(" "),
);

/** Lowercase word forms, with curly quotes folded and possessives kept as written. */
const tokens = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .match(/[\p{L}\p{N}][\p{L}\p{N}+#.'/-]*/gu)
    // A trailing apostrophe stays: "peers'" is a possessive, not "peers".
    ?.map((w) => w.replace(/[./-]+$/, "").replace(/(?<!s)'+$/, "")) ?? [];

/** A light stem, so "tests" matches "test" and "role-based" matches "role based". */
const stem = (w: string) =>
  w
    .replace(/'s$|s'$/, "")
    .replace(/(ies)$/, "y")
    .replace(/(?<=[a-z]{3})(es|s)$/, "");

const stems = (s: string) =>
  new Set(
    tokens(s)
      .flatMap((w) => w.split(/[-/]/))
      .map(stem),
  );

export type Vocabulary = string[][];

/** Terms named in text: each entry is one tool with all its names. */
function namedTerms(text: string, vocab: Vocabulary): string[][] {
  return vocab.filter((names) => names.some((n) => mentions(text, n)));
}

/**
 * Details of the source bullet that the tailored text lost. `jobText` adds
 * the rule that no word the job post uses may be dropped.
 */
export function droppedDetails(source: string, tailored: string, jobText: string, vocab: Vocabulary): string[] {
  const missing: string[] = [];
  const have = stems(tailored);
  const haveTokens = new Set(tokens(tailored));

  // Numbers, digits or words ("six input methods").
  const tailoredNumbers = extractNumbers(tailored);
  // A count may become the list it counts: "three-role access" and "(admin, doctor, patient)" say the same.
  const listLengths = [...tailored.matchAll(/\(([^)]+)\)/g)].map(
    (m) => m[1].split(/,|\band\b/).filter((x) => x.trim()).length,
  );
  for (const n of extractNumbers(source)) {
    if (tailoredNumbers.some((t) => t.value === n.value && t.unit === n.unit)) continue;
    if (n.unit === "" && n.value <= 12 && listLengths.includes(n.value)) continue;
    missing.push(n.raw.trim());
  }
  // Named tools ("Firebase Auth", "Gemini API").
  for (const names of namedTerms(source, vocab)) {
    if (!names.some((n) => mentions(tailored, n))) missing.push(names.find((n) => mentions(source, n)) ?? names[0]);
  }
  // What sits in parentheses ("(EN/FR)").
  for (const m of source.matchAll(/\(([^)]{1,60})\)/g)) {
    for (const w of m[1].match(/[\p{L}\p{N}][\p{L}\p{N}+#.]*/gu) ?? []) {
      const lower = w.toLowerCase();
      if (!STOP.has(lower) && !have.has(stem(lower))) missing.push(w);
    }
  }
  // Possessives keep their apostrophe ("peers' tasks").
  for (const w of tokens(source).filter((x) => /'s$|s'$/.test(x))) {
    if (!haveTokens.has(w)) missing.push(w);
  }
  // Every word the job post also uses.
  const job = stems(jobText);
  for (const w of tokens(source)) {
    for (const part of w.split(/[-/]/)) {
      const s = stem(part);
      if (part.length < 3 || STOP.has(part) || /^\d/.test(part) || !job.has(s)) continue;
      if (!have.has(s)) missing.push(part);
    }
  }
  return [...new Set(missing)];
}

/**
 * Numbers and named tools in the tailored text that its own source bullets
 * do not state. `source` is the text of the cited bullets only, never the
 * role's tech line or its other bullets.
 */
export function addedDetails(source: string, tailored: string, vocab: Vocabulary): string[] {
  const added: string[] = [];
  const sourceNumbers = extractNumbers(source);
  for (const n of extractNumbers(tailored)) if (unsupportedReason(n, sourceNumbers)) added.push(n.raw.trim());
  for (const names of namedTerms(tailored, vocab)) {
    if (!names.some((n) => mentions(source, n))) added.push(names.find((n) => mentions(tailored, n)) ?? names[0]);
  }
  return [...new Set(added)];
}

/**
 * Check 2e, readability: content words a tailored bullet repeats that its
 * source does not ("...on Firebase: ... on Firebase Auth").
 */
export function repeatedWords(source: string, tailored: string): string[] {
  const count = (s: string) => {
    const m = new Map<string, number>();
    for (const w of tokens(s).flatMap((x) => x.split(/[-/]/))) {
      if (w.length < 3 || STOP.has(w) || /^\d/.test(w)) continue;
      m.set(stem(w), (m.get(stem(w)) ?? 0) + 1);
    }
    return m;
  };
  const src = count(source);
  return [...count(tailored)].filter(([w, n]) => n > 1 && n > (src.get(w) ?? 0)).map(([w]) => w);
}

/**
 * Check 2f, readability: job terms stacked in front of the source sentence
 * ("Built role-based access control and authentication on Firebase:
 * three-role access (admin, doctor, patient) on Firebase Auth, ..."). True
 * when three quarters of the source's words still run on unchanged in the
 * bullet and a job term the source does not use sits before that run.
 */
export function stackedTerms(source: string, tailored: string, jobTerms: string[]): boolean {
  const s = tokens(source);
  const t = tokens(tailored);
  // Longest run of words shared in order (common substring over tokens).
  let best = 0;
  let bestEnd = 0;
  const prev = new Array(s.length + 1).fill(0);
  for (let i = 1; i <= t.length; i++) {
    let diag = 0;
    for (let j = 1; j <= s.length; j++) {
      const up = prev[j];
      prev[j] = t[i - 1] === s[j - 1] ? diag + 1 : 0;
      if (prev[j] > best) [best, bestEnd] = [prev[j], i];
      diag = up;
    }
  }
  if (s.length < 6 || best < s.length * 0.75) return false;
  const before = t.slice(0, bestEnd - best).join(" ");
  return jobTerms.some((term) => mentions(before, term) && !mentions(source, term));
}

/**
 * The job's term written into a source bullet in code, the way a person would
 * (check 2g): the words that prove it are replaced by it ("three-role access"
 * becomes "role-based access control"), or, when they name a tool, the term
 * follows as a short gloss ("Gemini API (LLM)"). Null when the bullet does not
 * prove the term. The caller keeps the result only if it passes the fidelity
 * checks, so a count dropped this way must survive as the list it counts.
 */
export function placeTerm(source: string, term: string, hit: string, forms: string[]): string | null {
  const at = source.toLowerCase().indexOf(hit.toLowerCase());
  if (at < 0) return null;
  if (mentions(source, term)) return source;
  const named = /^\p{Lu}/u.test(hit) || /\p{Lu}{2}/u.test(hit);
  if (named) {
    // A tool name: keep it, and name the job's term after it once, in its shortest form.
    const gloss = [...forms].filter((f) => f.length <= 12 && !mentions(hit, f)).sort((a, b) => a.length - b.length)[0];
    if (!gloss) return null;
    const end = at + hit.length;
    return `${source.slice(0, end)} (${gloss})${source.slice(end)}`;
  }
  // Plain words: replace them, with any hyphenated words joined to them ("three-role access").
  const prefix = /(?:[\p{L}\p{N}]+-)+$/u.exec(source.slice(0, at))?.[0] ?? "";
  return `${source.slice(0, at - prefix.length)}${term}${source.slice(at + hit.length)}`;
}
