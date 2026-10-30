import synonymsJson from "../../../data/skill-synonyms.json";

/**
 * The keyword matcher (docs/ATS_SCORING.md section 2). The same matcher splits
 * a job's keywords into matched and gaps before tailoring, finds gap leaks in
 * the validator, and computes coverage for the score, so all three agree.
 */

export const SECTION_NAMES = ["headline", "summary", "skills", "experience", "projects", "education", "other"] as const;
export type SectionName = (typeof SECTION_NAMES)[number];
export type CvSections = Partial<Record<SectionName, string[]>>;

export type KeywordLike = { term: string; canonical?: string; synonyms?: string[] };
export type MatchResult = { found: boolean; locations: SectionName[]; matchedForm: string };

/** data/skill-synonyms.json as [canonical, aliases] pairs. */
export const dictionary = Object.entries(synonymsJson as Record<string, string[] | string>).filter(
  (e): e is [string, string[]] => !e[0].startsWith("_") && Array.isArray(e[1]),
);

/**
 * Short names that are also ordinary words or letters. They match only with
 * the same capitalization and with tech nearby (rule 4).
 */
const AMBIGUOUS = new Set([
  "Go",
  "C",
  "R",
  "C#",
  "C++",
  ".NET",
  "Rust",
  "Swift",
  "Dart",
  "Elm",
  "Ruby",
  "Next",
  "Node",
  "Express",
  "REST",
  "RN",
  "JS",
  "TS",
  "Helm",
  "Unity",
  "Spark",
  "Rails",
]);
const isAmbiguous = (form: string) => AMBIGUOUS.has(form.trim());

const fold = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s._-]+/g, "");

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Regex source for one spelling: separator variants, slash compounds, simple plurals. */
function formSource(form: string, caseSensitive: boolean): string {
  const f = form.trim().normalize("NFKC");
  const words = f.split(/[\s-]+/).filter(Boolean);
  const body = words
    .map((w) =>
      w
        .split("/")
        .map((part) =>
          // "node.js" also matches "nodejs", "node js" and "node-js". A leading dot (".NET") stays literal.
          part
            .split(/(?<=.)[._]/)
            .map(escape)
            .join("[._\\s-]?"),
        )
        .join("(?:\\s*/\\s*|\\s+and\\s+)"),
    )
    .join("[\\s-]+");
  const last = f[f.length - 1];
  const plural = !caseSensitive && f.length >= 3 && /\p{L}/u.test(last) ? "(?:s|es)?" : "";
  return `(?<![\\p{L}\\p{N}_])${body}${plural}(?![\\p{L}\\p{N}_+#])`;
}

function formRegex(form: string): RegExp {
  const cs = isAmbiguous(form);
  return new RegExp(formSource(form, cs), cs ? "gu" : "giu");
}

/** Every known non-ambiguous tech name, for the "tech nearby" rule. */
const TECH_NEARBY = new RegExp(
  dictionary
    .flatMap(([c, aliases]) => [c, ...aliases])
    .filter((f) => !isAmbiguous(f) && f.length > 1)
    .sort((a, b) => b.length - a.length)
    .map((f) => formSource(f, false))
    .join("|"),
  "iu",
);

/** Ambiguous names count as tech nearby too, but only with their exact capitalization. */
const AMBIGUOUS_NEARBY = new RegExp([...AMBIGUOUS].map((f) => formSource(f, true)).join("|"), "u");

function techNearby(text: string, start: number, end: number, extra: RegExp | null): boolean {
  const before = text
    .slice(Math.max(0, start - 120), start)
    .split(/\s+/)
    .filter(Boolean)
    .slice(-6)
    .join(" ");
  const after = text
    .slice(end, end + 120)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(" ");
  const window = `${before} ${after}`;
  if (/^\s*\(golang\)/i.test(text.slice(end))) return true;
  return TECH_NEARBY.test(window) || AMBIGUOUS_NEARBY.test(window) || (extra?.test(window) ?? false);
}

/** All spellings to look for: the job's term, canonical name and synonyms, plus the synonym map. */
export function keywordForms(k: KeywordLike): string[] {
  const forms = new Map<string, string>();
  const add = (f: string | undefined) => {
    const t = f?.trim();
    // Case matters for ambiguous names ("Go" is a skill, "go" is a verb), so they keep their own key.
    const key = t && (isAmbiguous(t) ? `cs:${t}` : fold(t));
    if (t && key && !forms.has(key)) forms.set(key, t);
  };
  for (const f of [k.term, k.canonical, ...(k.synonyms ?? [])]) {
    add(f);
    if (!f) continue;
    const entry = dictionary.find(([c, aliases]) => fold(c) === fold(f) || aliases.some((a) => fold(a) === fold(f)));
    if (entry) [entry[0], ...entry[1]].forEach(add);
  }
  return [...forms.values()];
}

/** Longer known names that contain this spelling ("React Native" for "React"), which must not count as it. */
function longerNames(form: string, forms: string[]): RegExp | null {
  const re = new RegExp(formSource(form, isAmbiguous(form)), isAmbiguous(form) ? "u" : "iu");
  const own = new Set(forms.map(fold));
  const longer = dictionary
    .flatMap(([c, aliases]) => [c, ...aliases])
    .filter((name) => fold(name) !== fold(form) && !own.has(fold(name)) && name.length > form.length && re.test(name));
  if (!longer.length) return null;
  return new RegExp(longer.map((n) => formSource(n, false)).join("|"), "giu");
}

export type MatchOptions = {
  /** More tech names that count as "tech nearby" (the profile's skills, the job's keywords). */
  techTerms?: string[];
};

function extraTech(opts?: MatchOptions): RegExp | null {
  const terms = (opts?.techTerms ?? []).filter((t) => t.trim().length > 1 && !isAmbiguous(t));
  return terms.length ? new RegExp(terms.map((t) => formSource(t, false)).join("|"), "iu") : null;
}

/** The first spelling of `k` found in `text`, or null. `inSkills` relaxes the tech-nearby rule. */
export function findKeyword(k: KeywordLike, text: string, inSkills = false, opts?: MatchOptions): string | null {
  const t = text.normalize("NFKC").replace(/\s+/g, " ");
  const forms = keywordForms(k);
  const extra = extraTech(opts);
  for (const form of forms) {
    let hay = t;
    const longer = longerNames(form, forms);
    if (longer) hay = hay.replace(longer, (m) => "\u0000".repeat(m.length));
    for (const m of hay.matchAll(formRegex(form))) {
      const start = m.index ?? 0;
      if (!isAmbiguous(form) || inSkills || techNearby(hay, start, start + m[0].length, extra)) return m[0];
    }
  }
  return null;
}

export function matchKeyword(k: KeywordLike, sections: CvSections, opts?: MatchOptions): MatchResult {
  const locations: SectionName[] = [];
  let matchedForm = "";
  for (const name of SECTION_NAMES) {
    for (const line of sections[name] ?? []) {
      const hit = findKeyword(k, line, name === "skills", opts);
      if (hit) {
        if (!locations.includes(name)) locations.push(name);
        matchedForm ||= hit;
      }
    }
  }
  return { found: locations.length > 0, locations, matchedForm };
}
