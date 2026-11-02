import type { Salary } from "@/lib/jobs/types";

/**
 * Pay ranges in US dollars from a post's text: "$87,069-$130,000",
 * "$120k to $150k", "USD 6,000 - 8,000 per month". Only ranges, only dollars
 * that are not another currency's ("CA$", "A$"), and only numbers written in
 * the text; anything else stays unknown (golden rule 9). Other currencies
 * need exchange rates and are left for later (DECISIONS.md, 2026-11-02).
 */

const AMOUNT = String.raw`(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*([kK])?`;
const RANGE = new RegExp(
  String.raw`(?<![A-Za-z])(US\$|USD\s*|\$)\s*${AMOUNT}\s*(?:-|–|to|and)\s*(?:US\$|USD\s*|\$)?\s*${AMOUNT}(\s*USD)?`,
  "g",
);
const PERIOD: [RegExp, Salary["period"]][] = [
  [/^.{0,40}?\b(?:per hour|an hour|hourly|\/\s*h(?:ou)?r)\b/i, "hour"],
  [/^.{0,40}?\b(?:per day|a day|daily|\/\s*day)\b/i, "day"],
  [/^.{0,40}?\b(?:per month|a month|monthly|\/\s*mo(?:nth)?)\b/i, "month"],
];
const PER_YEAR: Record<Salary["period"], number> = { year: 1, month: 12, day: 260, hour: 2080 };

const num = (digits: string, k?: string) => Number(digits.replace(/,/g, "")) * (k ? 1000 : 1);

export function parseSalaryText(text: string): Salary | undefined {
  for (const m of text.matchAll(RANGE)) {
    const before = text.slice(Math.max(0, m.index - 3), m.index);
    // "CA$120,000", "A$", "NZ$", "HK$", "S$": not US dollars.
    if (m[1] === "$" && /[A-Z]$/.test(before)) continue;
    const min = num(m[2], m[3]);
    const max = num(m[4], m[5] ?? m[3]);
    if (!min || !max || max < min) continue;
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 60);
    // "$5 and $10 billion", "$2-3M in funding": money, not pay.
    if (/^\s*(?:million|billion|mn|bn|m|b)\b/i.test(after)) continue;
    const period = PERIOD.find(([re]) => re.test(after))?.[1] ?? (max < 500 ? "hour" : "year");
    const annualMin = min * PER_YEAR[period];
    const annualMax = max * PER_YEAR[period];
    if (annualMin < 5_000 || annualMax > 2_000_000) continue;
    return {
      min,
      max,
      currency: "USD",
      period,
      annualUsdMin: Math.round(annualMin),
      annualUsdMax: Math.round(annualMax),
      source: "parsed_text",
    };
  }
  return undefined;
}
