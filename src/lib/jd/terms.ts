import { dictionary, findKeyword, keywordForms } from "@/lib/ats/match";
import type { JobSpec } from "@/lib/profile/schema";
import { skillFold } from "@/lib/profile/skills";

/**
 * Deterministic job reading on top of P2 (docs/AI_PROMPTS.md, "P2 code
 * checks"). P2 sometimes leaves out terms the post plainly states
 * ("authentication", "role-based access control", "LLM APIs"), and it labels
 * the same term "must" on one run and "nice" on the next, which moved the
 * score by up to 20 points between runs of one post. So:
 *  1. every term of data/skill-synonyms.json the post states is a keyword,
 *     whether or not the model listed it;
 *  2. must or nice comes from where the term sits in the post (a "Nice to
 *     have" line or section), not from the model.
 */

const NICE = /nice[- ]to[- ]have|\bbonus\b|\ba plus\b|\bpreferred\b|good to have|would be great|\bideally\b/i;
const MUST =
  /requirements|\brequired\b|must[- ]have|what you (will )?(need|bring|have)|qualifications|responsibilities|what you will do|you will|you have|about the role|the role/i;

/** "must" or "nice" for text at `index` of the post: its own line first, then the nearest section marker above it. */
export function importanceAt(text: string, index: number): "must" | "nice" {
  const lineStart = text.lastIndexOf("\n", index) + 1;
  const lineEnd = text.indexOf("\n", index);
  const line = text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
  if (NICE.test(line)) return "nice";
  if (MUST.test(line.split(/[:.]/)[0] ?? "")) return "must";
  const before = text.slice(0, lineStart).split("\n").reverse();
  for (const l of before) {
    // A heading-like line: short, or ending in a colon.
    if (l.trim().length > 60 && !/:\s*$/.test(l)) continue;
    if (NICE.test(l)) return "nice";
    if (MUST.test(l)) return "must";
  }
  return "must";
}

/** The longest name of a dictionary entry that the post states, as written there. */
function statedForm(names: string[], text: string): { form: string; index: number } | null {
  for (const name of [...names].sort((a, b) => b.length - a.length)) {
    // findKeyword applies the ambiguity rules ("Go" the language, not the verb); keep only a hit of this exact name.
    const hit = findKeyword({ term: name }, text);
    if (hit && skillFold(hit) === skillFold(name)) return { form: hit, index: text.indexOf(hit) };
  }
  for (const name of names) {
    const hit = findKeyword({ term: name }, text);
    if (hit) return { form: hit, index: text.indexOf(hit) };
  }
  return null;
}

export function addStatedTerms(spec: JobSpec, text: string): JobSpec {
  const have = new Set(spec.keywords.flatMap((k) => keywordForms(k)).map(skillFold));
  const added: JobSpec["keywords"] = [];
  for (const [canonical, aliases] of dictionary) {
    const names = [canonical, ...aliases];
    if (names.some((n) => have.has(skillFold(n)))) continue;
    const hit = statedForm(names, text);
    if (!hit || hit.index < 0) continue;
    const lineStart = text.lastIndexOf("\n", hit.index) + 1;
    const lineEnd = text.indexOf("\n", hit.index);
    const quote = text
      .slice(lineStart, lineEnd < 0 ? undefined : lineEnd)
      .trim()
      .slice(0, 300);
    added.push({
      term: hit.form,
      canonical,
      synonyms: aliases.filter((a) => skillFold(a) !== skillFold(hit.form)),
      importance: importanceAt(text, hit.index),
      kind: "hard_skill",
      evidenceQuote: quote.includes(hit.form) ? quote : hit.form,
    });
    names.forEach((n) => have.add(skillFold(n)));
  }
  const keywords = [...spec.keywords, ...added].map((k) => {
    if (k.kind === "title") return k;
    const at = text.indexOf(k.evidenceQuote);
    return at >= 0 ? { ...k, importance: importanceAt(text, at) } : k;
  });
  return { ...spec, keywords };
}
