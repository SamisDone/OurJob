import { COUNTRY_CODES } from "@/lib/geo";
import type { RemoteScope, Workplace } from "@/lib/jobs/types";

/**
 * Location strings and structured hints to a workplace and a RemoteScope
 * (docs/JOB_SOURCES.md section 9). Structured fields first, then rules on the
 * strings. Plain "Remote" says nothing about where, so it stays unknown: P4
 * may settle it from the description with a quote.
 */

const ALIASES: Record<string, string> = {
  usa: "US",
  us: "US",
  "u.s.": "US",
  "u.s.a.": "US",
  "united states of america": "US",
  america: "US",
  uk: "GB",
  "u.k.": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  britain: "GB",
  "great britain": "GB",
  uae: "AE",
  "south korea": "KR",
  korea: "KR",
  czechia: "CZ",
  "czech republic": "CZ",
  turkey: "TR",
  türkiye: "TR",
  vietnam: "VN",
  russia: "RU",
  holland: "NL",
  "the netherlands": "NL",
};

const REGIONS: [RegExp, string][] = [
  [/\bemea\b/i, "EMEA"],
  [/\bapac\b|\basia[- ]pacific\b/i, "APAC"],
  [/\bamericas\b|\bamer\b/i, "Americas"],
  [/\bnorth america\b|\bnorthern america\b/i, "North America"],
  [/\blatam\b|\blatin america\b|\bsouth america\b|\bcentral america\b/i, "LATAM"],
  [/\beurope\b|\beuropean union\b|\beu\b|\beea\b/i, "Europe"],
  [/\bmiddle east\b|\bmena\b/i, "Middle East"],
  [/\bafrica\b/i, "Africa"],
  [/\boceania\b|\banz\b/i, "Oceania"],
  [/\b(?:south |southeast |south-east |east )?asia\b/i, "Asia"],
];

const WORLDWIDE =
  /\b(?:anywhere|worldwide|world-wide|global(?:ly)?|international|any (?:country|location)|all countries)\b/i;
const REMOTE = /\bremote\b|\bwfh\b|\bwork from home\b|\bdistributed\b|\btelecommute\b/i;
const HYBRID = /\bhybrid\b/i;
const ONSITE = /\bon-?site\b|\bin[- ]office\b|\bin person\b/i;
/** "TBD", "N/A", "Multiple locations": a location field that says nothing. */
const PLACEHOLDER = /^(?:tbd|tba|n\/?a|none|various|multiple(?: locations)?|flexible|-+)$/i;

const US_STATES =
  "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(
    " ",
  );
const CA_PROVINCES = "AB BC MB NB NL NS NT NU ON PE QC SK YT".split(" ");

let byName: Map<string, string> | null = null;
function countryNames() {
  if (byName) return byName;
  byName = new Map(Object.entries(ALIASES));
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  for (const code of COUNTRY_CODES) {
    const name = names.of(code);
    if (name && name !== code) byName.set(name.toLowerCase(), code);
  }
  return byName;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Countries a location string names: country names, aliases, ISO codes on their own, US states, Canadian provinces. */
export function countriesIn(text: string): string[] {
  const found = new Set<string>();
  // US states named like countries: "New Jersey" is not Jersey, "New Mexico" is not Mexico.
  if (/\bnew (?:jersey|mexico)\b/i.test(text)) found.add("US");
  const lower = text.toLowerCase().replace(/\bnew (?:jersey|mexico)\b/g, "");
  for (const [name, code] of countryNames()) {
    if (name.length <= 3 && name !== "usa" && name !== "uae") continue; // "us", "uk": matched as whole tokens below
    if (new RegExp(`(?<![\\p{L}])${escape(name)}(?![\\p{L}])`, "u").test(lower)) found.add(code);
  }
  for (const token of text.split(/[\s,()/\-–]+/)) {
    const t = token.replace(/\.$/, "");
    const alias = ALIASES[t.toLowerCase()];
    if (alias && t.length <= 4 && (t === t.toUpperCase() || t.includes("."))) found.add(alias);
    if (/^[A-Z]{2}$/.test(t)) {
      if (US_STATES.includes(t) && /,\s*[A-Z]{2}\b/.test(text)) found.add("US");
      else if (CA_PROVINCES.includes(t) && /,\s*[A-Z]{2}\b/.test(text)) found.add("CA");
      else if (COUNTRY_CODES.includes(t) && !US_STATES.includes(t)) found.add(t);
    }
  }
  return [...found];
}

export function regionsIn(text: string): string[] {
  return REGIONS.filter(([re]) => re.test(text)).map(([, r]) => r);
}

type Place = { worldwide: boolean; countries: string[]; regions: string[] };
const placeOf = (text: string): Place => {
  // "Asia" inside "Asia Pacific" is APAC only; "Europe" in "European Union" is Europe once.
  const regions = regionsIn(text).filter((r) => !(r === "Asia" && /asia[- ]pacific/i.test(text)));
  const countries = countriesIn(text);
  // "Remote Global (US, EU)" names its places, so it is those places, not worldwide.
  const worldwide = WORLDWIDE.test(text) && !regions.length && !countries.length;
  return { worldwide, countries, regions };
};
const hasPlace = (p: Place) => p.worldwide || p.countries.length > 0 || p.regions.length > 0;

export function locate(
  locations: string[],
  hints: { workplace?: Workplace; countries?: string[] } = {},
): { workplace: Workplace; remoteScope: RemoteScope } {
  const segments = locations.map((text) => ({
    text,
    place: placeOf(text),
    remote: REMOTE.test(text) || WORLDWIDE.test(text),
  }));
  const anyRemote = segments.some((s) => s.remote);
  const workplace: Workplace =
    hints.workplace && hints.workplace !== "unknown"
      ? hints.workplace
      : anyRemote
        ? "remote"
        : segments.some((s) => HYBRID.test(s.text))
          ? "hybrid"
          : // A city or country with no word about remote work ("Toronto", "London, UK") is an office job.
            segments.some((s) => ONSITE.test(s.text) || hasPlace(s.place) || !PLACEHOLDER.test(s.text.trim()))
            ? "onsite"
            : "unknown";

  // For a remote job, only the remote segments say where he may work from ("Remote, Canada; Toronto").
  const relevant = workplace === "remote" && anyRemote ? segments.filter((s) => s.remote) : segments;
  const places = relevant.map((s) => s.place).filter(hasPlace);
  const confidence: RemoteScope["confidence"] = hints.workplace ? "structured" : "parsed";
  if (places.some((p) => p.worldwide)) return { workplace, remoteScope: { kind: "worldwide", confidence } };
  const countries = [...new Set(places.flatMap((p) => p.countries))];
  const regions = [...new Set(places.flatMap((p) => p.regions))];
  if (countries.length || regions.length) return { workplace, remoteScope: scope(countries, regions, confidence) };

  // The strings name no place: the source's structured country (Lever's `country`, Ashby's address) decides.
  const codes = (hints.countries ?? []).filter((c) => /^[A-Z]{2}$/.test(c));
  const named = (hints.countries ?? []).filter((c) => !/^[A-Z]{2}$/.test(c)).map(placeOf);
  const hintCountries = [...new Set([...codes, ...named.flatMap((p) => p.countries)])];
  const hintRegions = [...new Set(named.flatMap((p) => p.regions))];
  if (hintCountries.length || hintRegions.length)
    return { workplace, remoteScope: scope(hintCountries, hintRegions, "structured") };
  return { workplace, remoteScope: { kind: "unknown", confidence } };
}

const scope = (countries: string[], regions: string[], confidence: RemoteScope["confidence"]): RemoteScope =>
  regions.length
    ? { kind: "regions", regions, ...(countries.length ? { countries } : {}), confidence }
    : { kind: "countries", countries, confidence };
