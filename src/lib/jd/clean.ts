/**
 * Cleans a pasted job post (select-all text from a careers page is fine):
 * normalizes Unicode and whitespace, drops page chrome (navigation, share and
 * cookie lines) and repeated lines, and caps the length. The result is what
 * P2 sees and what its evidence quotes must be substrings of.
 */

export const MAX_JD_CHARS = 20_000;

// Whole lines that are page furniture, not part of the post.
const CHROME = [
  /^(apply( now| for this (job|role|position))?|apply on (company )?website|easy apply)$/i,
  /^(save( job)?|share( this (job|role))?|copy link|report( this)? job|back to (all )?jobs|view all jobs|see all jobs)$/i,
  /^(sign in|log in|sign up|join now|register|menu|skip to (main )?content|home|careers|jobs|search jobs)$/i,
  /^(accept( all)?( cookies)?|reject( all)?|cookie (settings|preferences)|manage cookies)$/i,
  /^(we use cookies|this (site|website) uses cookies)\b.*$/i,
  /^(share on )?(facebook|twitter|x|linkedin|email)$/i,
  /^(powered by \w+)$/i,
  /^[\s|•·>›»/\\-]*$/,
];

export function cleanJobText(raw: string): string {
  const text = raw
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[​-‍﻿­]/g, "")
    .replace(/[\t  -   　]+/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');

  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split("\n").map((l) => l.replace(/ {2,}/g, " ").trim())) {
    if (!line) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    if (CHROME.some((re) => re.test(line))) continue;
    // Pasted pages repeat headings and buttons; keep the first copy of any line longer than a word or two.
    const key = line.toLowerCase();
    if (line.length > 12 && seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n").slice(0, MAX_JD_CHARS).trim();
}
