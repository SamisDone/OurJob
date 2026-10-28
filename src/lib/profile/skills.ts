import synonymsJson from "../../../data/skill-synonyms.json";

/**
 * Canonical skill names from data/skill-synonyms.json ("Postgres" to
 * "PostgreSQL"). Keys are canonical; values are other spellings.
 */
const entries = Object.entries(synonymsJson as Record<string, string[] | string>).filter(
  (e): e is [string, string[]] => !e[0].startsWith("_") && Array.isArray(e[1]),
);

const fold = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s._-]+/g, "");

const toCanonical = new Map<string, string>();
for (const [canonical, aliases] of entries) {
  toCanonical.set(fold(canonical), canonical);
  for (const a of aliases) toCanonical.set(fold(a), canonical);
}

/** The canonical name for a skill, or the name as given when it is not in the map. */
export function canonicalSkill(name: string): string {
  return toCanonical.get(fold(name)) ?? name.trim();
}

/** Known other spellings for a canonical skill. */
export function knownAliases(canonical: string): string[] {
  return entries.find(([c]) => c === canonical)?.[1] ?? [];
}

export function skillFold(name: string): string {
  return fold(name);
}

/** Word-boundary, case-insensitive check that `term` appears in `text`. "Java" does not match "JavaScript". */
export function mentions(text: string, term: string): boolean {
  const t = term.trim();
  if (!t) return false;
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}+#])`, "iu").test(text);
}
