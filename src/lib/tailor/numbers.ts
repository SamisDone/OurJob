/**
 * Numbers in CV text, for validator check 3 (docs/AI_PROMPTS.md): a tailored
 * bullet may only use numbers its source items contain, with the same or a
 * weaker claim, and keeps any hedge ("roughly 60%").
 */

export type NumberUnit = "" | "%" | "x" | "p";

export type FoundNumber = {
  raw: string;
  value: number;
  unit: NumberUnit;
  /** "20+", "over 20", "more than 20": a lower bound. */
  atLeast: boolean;
  hedged: boolean;
  index: number;
};

const SPELLED: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

const HEDGES =
  /(?:^|\s)(?:about|around|roughly|approximately|approx\.?|nearly|almost|an estimated|estimated|some|close to|~)\s*$/i;
const LOWER_BOUND = /(?:^|\s)(?:over|more than|above|upwards of)\s*$/i;

// Groups: 1 p99 | 2 "~" | 3 digits | 4 k/M/B | 5 "+" | 6 % or x | 7 spelled one..twenty
const NUMBER =
  /(?<![\p{L}\p{N}])(?:p(\d{2,3}(?:\.\d+)?)|(~\s?)?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(\s?[kKmMbB](?![\p{L}]))?(\+)?(\s?%|x(?![\p{L}]))?|(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)(?![\p{L}]))/giu;

const MAGNITUDE: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

export function extractNumbers(text: string): FoundNumber[] {
  const out: FoundNumber[] = [];
  for (const m of text.matchAll(NUMBER)) {
    const g = { p: m[1], tilde: m[2], num: m[3], mag: m[4], plus: m[5], unit: m[6], word: m[7] };
    const index = m.index ?? 0;
    const before = text.slice(Math.max(0, index - 24), index);
    let value: number;
    let unit: NumberUnit = "";
    if (g.p) {
      value = Number(g.p);
      unit = "p";
    } else if (g.word) {
      value = SPELLED[g.word.toLowerCase()];
    } else {
      value = Number(g.num.replace(/,/g, ""));
      if (g.mag) value *= MAGNITUDE[g.mag.trim().toLowerCase()];
      if (g.unit) unit = g.unit.trim().toLowerCase() === "x" ? "x" : "%";
    }
    out.push({
      raw: m[0],
      value,
      unit,
      atLeast: Boolean(g.plus) || LOWER_BOUND.test(before),
      hedged: Boolean(g.tilde) || HEDGES.test(before),
      index,
    });
  }
  return out;
}

/** Why `claim` is not supported by any number in the sources, or null when it is. */
export function unsupportedReason(claim: FoundNumber, sources: FoundNumber[]): string | null {
  const sameUnit = sources.filter((s) => s.unit === claim.unit);
  // "20+" is supported by 20, 20+ or 35; a plain "20" needs a 20.
  const backing = sameUnit.filter((s) => (claim.atLeast ? s.value >= claim.value : s.value === claim.value));
  if (!backing.length) return `"${claim.raw.trim()}" is not in its source items.`;
  if (!claim.atLeast && backing.every((s) => s.atLeast) && claim.unit === "") {
    // "2,000+ merchants" may stay "2,000+", never become an exact "2,000".
    return `"${claim.raw.trim()}" drops the "+" its source has.`;
  }
  if (backing.every((s) => s.hedged) && !claim.hedged) {
    return `"${claim.raw.trim()}" drops the hedge its source has (for example "roughly").`;
  }
  return null;
}
