/** Shapes from docs/JOB_SOURCES.md and docs/ATS_SCORING.md. */

export type RemoteScope = {
  kind: "worldwide" | "regions" | "countries" | "unknown";
  regions?: string[];
  countries?: string[]; // ISO 3166-1 alpha-2
  timezones?: { minUtcOffset: number; maxUtcOffset: number } | null;
  notes?: string;
  evidenceQuote?: string;
  confidence: "structured" | "parsed" | "llm";
};

export type Salary = {
  min?: number;
  max?: number;
  currency: string;
  period: "year" | "month" | "hour" | "day";
  annualUsdMin?: number;
  annualUsdMax?: number;
  source: "structured" | "parsed_text" | "board";
};

export type Attribution = { label: string; url: string };

export type Workplace = "remote" | "hybrid" | "onsite" | "unknown";
export type EmploymentType = "full_time" | "part_time" | "contract" | "internship" | "temporary";
export type PostedAtSource = "source_field" | "jsonld" | "first_seen" | "unknown";

export type AtsReport = {
  score: number;
  components: { id: string; label: string; points: number; max: number; detail: string }[];
  matched: { term: string; importance: "must" | "nice"; locations: string[] }[];
  missing: { term: string; importance: "must" | "nice"; inProfile: boolean }[];
  checks: { id: string; label: string; pass: boolean; fix?: string }[];
};

export type ValidatorReport = {
  entries: {
    check:
      "ids" | "source_support" | "numbers" | "bold_and_tech" | "skills" | "gap_leak" | "coverage" | "style" | "length";
    itemRef: string;
    ok: boolean;
    message: string;
  }[];
  removed: { itemRef: string; text: string; reason: string }[];
  fixRounds: number;
};

export type PipelineStats = {
  sources: Record<string, { fetched: number; new: number; errors: number }>;
  companiesCrawled: number;
  jobsScored: number;
  llmCalls: number;
};
