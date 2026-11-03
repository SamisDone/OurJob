import type { Attribution, EmploymentType, PostedAtSource, RemoteScope, Salary, Workplace } from "@/lib/jobs/types";

/** The ATS boards with an adapter (docs/JOB_SOURCES.md section 2). */
export type AtsType = "greenhouse" | "lever" | "ashby";

/** One company's board on one ATS. */
export type Board = { ats: AtsType; slug: string; companyName: string };

/** What an adapter reads from one posting; `normalizePosting` derives the rest. */
export type Posting = {
  sourceJobId: string;
  title: string;
  html: string;
  /** Text the source keeps outside the description (Lever's "additional" holds pay ranges). */
  extraHtml?: string;
  url: string;
  applyUrl: string;
  /** Each location the source lists, as written. */
  locations: string[];
  /** What the source states in structured fields; the location rules trust these first. */
  hints: { workplace?: Workplace; countries?: string[] };
  employmentType?: EmploymentType;
  /** Only a real publish or create date, never an edit date. */
  postedAt?: Date;
  salary?: Salary;
};

/** docs/JOB_SOURCES.md section 7. */
export type NormalizedJob = {
  source: string;
  tier: 1 | 2 | 3;
  sourceJobId: string;
  companyName: string;
  atsType?: AtsType;
  atsSlug?: string;
  title: string;
  descriptionHtml: string;
  descriptionText: string;
  applyUrl: string;
  canonicalUrl: string;
  locationRaw: string;
  workplace: Workplace;
  remoteScope: RemoteScope;
  employmentType?: EmploymentType;
  salary?: Salary;
  postedAt?: Date;
  postedAtSource: PostedAtSource;
  attribution?: Attribution;
  /** When the source says the listing ends (Himalayas `expiryDate`); stored as the job's close date. */
  closesAt?: Date;
};

/** A board adapter: the URL to fetch, and the response to postings. Fetching goes through the polite client. */
export type BoardAdapter = {
  id: AtsType;
  tier: 1;
  /** "Careers page (Greenhouse)" on the job card. */
  label: string;
  url(slug: string): string;
  /** Postings in a board response; one the adapter cannot read is skipped. */
  parse(json: unknown): Posting[];
};
