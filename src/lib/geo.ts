/**
 * Countries and regions for search preferences. Names come from
 * Intl.DisplayNames; only ISO 3166-1 alpha-2 codes and a continent table are
 * stored here. "My region" in preferences maps to the continent plus the
 * wider labels job boards use (APAC, EMEA, Americas).
 */

const BY_CONTINENT: Record<string, string> = {
  Africa:
    "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW",
  Asia: "AF AM AZ BH BD BT BN KH CN CY GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE",
  Europe:
    "AX AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB VA",
  Americas:
    "AI AG AR AW BS BB BZ BM BO BQ BR CA KY CL CO CR CU CW DM DO EC SV FK GF GL GD GP GT GY HT HN JM MQ MX MS NI PA PY PE PR BL KN LC MF PM VC SX SR TT TC US UY VE VG VI",
  Oceania: "AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF",
};

const CONTINENT_OF = new Map<string, string>();
for (const [continent, codes] of Object.entries(BY_CONTINENT))
  for (const c of codes.split(" ")) CONTINENT_OF.set(c, continent);

export const COUNTRY_CODES = [...CONTINENT_OF.keys()];

export function countryName(code: string, locale = "en"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function countryOptions(locale = "en") {
  return COUNTRY_CODES.map((code) => ({ value: code, label: countryName(code, locale) })).sort((a, b) =>
    a.label.localeCompare(b.label, locale),
  );
}

/** Regions a job ad might name that include this country: ["Asia", "APAC"] for Bangladesh. */
export function regionsFor(code: string | undefined): string[] {
  const continent = code ? CONTINENT_OF.get(code) : undefined;
  if (!continent) return [];
  const wide = continent === "Asia" || continent === "Oceania" ? "APAC" : continent === "Americas" ? undefined : "EMEA";
  return wide ? [continent, wide] : [continent];
}

export function timezoneOptions(): { value: string; label: string }[] {
  const zones: string[] = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"];
  return zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") }));
}
