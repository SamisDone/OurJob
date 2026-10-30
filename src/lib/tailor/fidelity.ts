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

const stems = (s: string) => new Set(tokens(s).flatMap((w) => w.split(/[-/]/)).map(stem));

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
  for (const n of extractNumbers(source)) {
    if (!tailoredNumbers.some((t) => t.value === n.value && t.unit === n.unit)) missing.push(n.raw.trim());
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
