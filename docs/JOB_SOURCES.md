# Job sources

This doc defines where jobs come from, how companies are discovered, and how jobs are normalized, deduplicated, dated and filtered.

**Status of the facts below:** endpoints and terms were collected from public docs and third-party write-ups in October 2026. Field names marked "(verify)" are expected, not confirmed. Before writing any adapter, follow golden rule 3 in `CLAUDE.md`: read the current official docs, make one real request, save the response to `tests/fixtures/sources/<source>/`, and code against the fixture.

## 1. Source tiers

| Tier | What | Trust | Shown as |
|---|---|---|---|
| 1. Company direct | The company's own ATS job board API, or JobPosting structured data on the company's own careers site | Highest. The posting is the original. | "Direct from {Company}'s careers page ({ATS})" |
| 2. Job boards | Remote job boards and community hiring posts with official APIs or feeds | Medium. Usually a copy or a company-written post. | "Found on {Board}" plus the board's required attribution link |
| 3. Aggregators | Paid-tier APIs with free quotas that index many sites | Lowest. Often copies of copies. Optional, enabled only when a key is set. | "Found via {Aggregator}" |

**Preference rule:** when one real-world job is found in several tiers, keep one record, show the highest-tier version, and remember the other sources for dedupe. When a tier 2 or 3 job's apply link points to a supported ATS (section 3), fetch that ATS board, store the direct posting, and add the company to tracking. This is also the main discovery engine for lesser-known companies.

Each adapter implements one interface:

```ts
interface SourceAdapter {
  id: string;                         // "greenhouse", "remotive", ...
  tier: 1 | 2 | 3;
  enabled(env): boolean;              // false if a needed key is missing
  fetch(ctx: FetchContext): AsyncIterable<RawJob>;   // respects rate limits
  normalize(raw: RawJob): NormalizedJob | null;      // null = skip
}
```

## 2. Tier 1: company ATS boards (no key needed)

All are public, read-only endpoints that companies use to embed their own job listings. One request per company per run. They do not offer global search, so we need a list of companies (section 5).

| ATS | Endpoint (list jobs) | Notes |
|---|---|---|
| Greenhouse | `GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` | Greenhouse's docs say Job Board GET endpoints need no auth. `content=true` includes the HTML description. Date fields: `updated_at` is always present; look for `first_published` (verify). `updated_at` is NOT a post date. |
| Lever | `GET https://api.lever.co/v0/postings/{site}?mode=json` | Published postings are public. EU-hosted boards use `api.eu.lever.co` (verify). Date: `createdAt` in ms epoch (verify). Some write-ups mention a 1 request/second crawl delay; respect it. |
| Ashby | `GET https://api.ashbyhq.com/posting-api/job-board/{name}?includeCompensation=true` | Compensation summaries when the company publishes them. Date: `publishedAt` (verify). Has `isRemote` / location fields (verify). |
| Workable | `GET https://apply.workable.com/api/v1/widget/accounts/{account}` | Widget endpoint. Some sources pace it at 1 request per 3 seconds; do the same. Date field (verify). |
| SmartRecruiters | `GET https://api.smartrecruiters.com/v1/companies/{company}/postings` | Paginated. Date: `releasedDate` (verify). |
| Recruitee | `GET https://{company}.recruitee.com/api/offers` | Date: `published_at` or `created_at` (verify). |

Later (Phase 4+, only after Phase 3 works): Personio, Breezy HR (`https://{company}.breezy.hr/json`), HireHive, Manatal. Workday has no documented public posting API; skip it unless Sam approves a plan.

**Careers sites without a known ATS:** many company careers pages embed schema.org `JobPosting` JSON-LD for search engines. Adapter `careers-jsonld` fetches the company's careers URL (and job detail pages linked from it, max 50 per company), parses `<script type="application/ld+json">`, and keeps `@type: JobPosting` entries. Use `datePosted`, `jobLocationType: TELECOMMUTE`, `applicantLocationRequirements`, `baseSalary`. Respect `robots.txt` for this adapter.

## 3. ATS detection (company website or careers URL to a board)

Given a URL, detect the ATS and slug:

1. Pattern match the URL itself:
   - `boards.greenhouse.io/{token}`, `job-boards.greenhouse.io/{token}` (and `.eu.` hosts) to Greenhouse
   - `jobs.lever.co/{site}`, `jobs.eu.lever.co/{site}` to Lever
   - `jobs.ashbyhq.com/{name}` to Ashby
   - `apply.workable.com/{account}` to Workable
   - `careers.smartrecruiters.com/{company}`, `jobs.smartrecruiters.com/{company}` to SmartRecruiters
   - `{company}.recruitee.com` to Recruitee
2. Otherwise fetch the page (and `/careers`, `/jobs` on the company domain) and search the HTML for those patterns, for Greenhouse embed scripts (`boards.greenhouse.io/embed/job_board?for={token}`), and for JobPosting JSON-LD.
3. Optionally probe slugs derived from the domain (`acme.com` to `acme`) against the ATS APIs, max 6 probes per company, 1 request/second. A 200 with jobs is a candidate.
4. Confirm the match: the board's company name or links should match the website domain. Unconfirmed matches are stored with `verified = false` and shown in the Companies screen for one-click confirmation.

## 4. Tier 2: job boards and community posts

Use only official APIs or feeds. Store the attribution fields each one requires and show them on the card.

| Source | Endpoint | Terms to follow (verify on their site) |
|---|---|---|
| Remotive | `GET https://remotive.com/api/remote-jobs` (`category`, `search`, `limit`) | Listings are delayed 24 hours. Their published terms ask for at most 4 fetches a day and block more than 2 requests a minute. Link back to Remotive and credit it. Do not use their jobs to collect signups. |
| Himalayas | `GET https://himalayas.app/jobs/api/search?...` and `GET https://himalayas.app/jobs/api?limit=20&cursor=...` | No key. Location and timezone restrictions are structured fields. Reported terms: use their `apply_url`, visibly credit Himalayas with a link, do not redistribute to other job boards. |
| RemoteOK | `GET https://remoteok.com/api` | JSON array; the first element is a legal notice (verify). Expect attribution and link-back requirements. |
| Jobicy | `GET https://jobicy.com/api/v2/remote-jobs?count=50&tag=...` | Reported rate limit about once per hour. |
| Arbeitnow | `GET https://www.arbeitnow.com/api/job-board-api` | Mostly Europe. Has `remote` and `visa_sponsorship` filters (verify). |
| We Work Remotely | Category RSS feeds, for example the programming category feed (verify current URLs) | RSS only; no full API. |
| Hacker News "Who is hiring?" | Monthly thread via the HN Algolia API (`hn.algolia.com/api/v1/search?tags=story,author_whoishiring` then `/api/v1/items/{id}`) (verify) | Posts are written by the companies themselves, so treat them as high quality. Parse each top-level comment with the LLM (P6) into company, roles, remote scope, careers link. Use for jobs and for company discovery. |

## 5. Tier 3: aggregator APIs (optional, need keys)

Off unless the env key is set. Use small daily query budgets so the free quota lasts the month.

| Source | Endpoint | Free tier (as reported Oct 2026, verify) | Budget per daily run |
|---|---|---|---|
| Adzuna | `GET https://api.adzuna.com/v1/api/jobs/{country}/search/{page}?app_id=&app_key=&what=&max_days_old=7` | About 1,000 calls a month. Covers a fixed set of countries; check whether his country is included. | 20 calls |
| JSearch (OpenWeb Ninja or RapidAPI) | `GET /search?query=...&date_posted=week&remote_jobs_only=true` (verify params) | 200 requests a month, hard limit, no card. Pulls from Google for Jobs (includes LinkedIn, Indeed and company sites). | 5 calls |

Queries are built from the search profile: each target title combined with "remote", plus the top 3 skills.

## 6. Company discovery (finding lesser-known companies)

Companies table grows from these inputs, in order of value:

1. **Apply links in tier 2 and 3 jobs** that point to a supported ATS (section 3). Biggest source.
2. **HN "Who is hiring?"** careers links.
3. **remoteintech/remote-jobs** on GitHub: a community directory of remote-friendly tech companies (ISC license, one Markdown file per company with YAML frontmatter; check `CONTRIBUTING.md` for the current schema). Import company name and website, then run ATS detection. Re-sync weekly.
4. **Seed file in this repo**: `data/companies.seed.json`, a list of `{ name, website, careersUrl? }` that contributors can extend by pull request.
5. **Manual add** in the Companies screen.

Each company row tracks `discovered_via`, `first_seen_at`, and `open_roles_count`. "Lesser-known" is approximated (no source labels this): a company is boosted when it is not in `data/well-known-companies.json` (a short list of large, famous employers, editable) and has under 500 open roles. Pratik can mute any company.

**Crawl budget per run:** all companies with a matching role in the last 30 days, plus a rotating slice of the rest so every company is checked at least once every 3 days. Default cap 400 companies per run. With 1 request/second per host and different hosts in parallel (max 4 concurrent hosts), this fits in a few minutes.

## 7. Normalized job

```ts
type NormalizedJob = {
  source: string;               // adapter id
  tier: 1 | 2 | 3;
  sourceJobId: string;          // id within the source
  companyName: string;
  companyWebsite?: string;
  atsType?: string; atsSlug?: string;
  title: string;
  descriptionHtml: string;      // sanitized before storage
  descriptionText: string;
  applyUrl: string;
  canonicalUrl: string;         // url with tracking params stripped
  locationRaw: string;
  workplace: "remote" | "hybrid" | "onsite" | "unknown";
  remoteScope: RemoteScope;     // see section 9
  employmentType?: "full_time" | "part_time" | "contract" | "internship" | "temporary";
  salary?: { min?: number; max?: number; currency: string; period: "year" | "month" | "hour" | "day"; annualUsdMin?: number; annualUsdMax?: number; source: "structured" | "parsed_text" };
  postedAt?: Date;              // only when reliable, see section 8
  postedAtSource: "source_field" | "jsonld" | "first_seen" | "unknown";
  attribution?: { label: string; url: string };   // tiers 2 and 3
  raw: unknown;                 // kept for debugging, trimmed
};
```

## 8. Dates and the 7-day rule

- Use the source's own publish or create date when it exists and is a real post date.
- Greenhouse `updated_at` changes when a job is edited, so it is not a post date. Use `first_published` if present (verify); otherwise fall back to `first_seen_at`.
- `first_seen_at` is when our crawler first saw the job. It is reliable only after a company has been tracked for at least one previous run. So: **on the first crawl of a newly added company, jobs without a real post date are stored but not shown as fresh.** From the second crawl on, a job first seen today counts as posted today.
- Remotive delays listings 24 hours; its dates are still the original publish dates.
- A job is in the feed if `postedAt >= now - 7 days`. Jobs that disappear from their source are marked closed (`closed_at`) and hidden.

## 9. Remote eligibility (critical for working from Bangladesh)

Many "remote" jobs are limited to one country or region. Every job gets a `RemoteScope`:

```ts
type RemoteScope = {
  kind: "worldwide" | "regions" | "countries" | "unknown";
  regions?: string[];           // "EMEA", "APAC", "Americas", "Europe", ...
  countries?: string[];         // ISO 3166-1 alpha-2
  timezones?: { minUtcOffset: number; maxUtcOffset: number } | null;
  notes?: string;               // "must overlap 4 hours with US Eastern"
  confidence: "structured" | "parsed" | "llm";
};
```

Order of evidence: structured fields from the source (Himalayas, Ashby, JSON-LD `applicantLocationRequirements`), then rules on the location string ("Remote - US" means countries=[US]; "Remote (Worldwide)" means worldwide; "Anywhere" means worldwide), then the LLM (P4) reading the description for phrases like "must be based in", "US citizens only", "authorized to work in". Eligibility test: worldwide, or his country is in `countries`, or his region is in `regions`, and the timezone window fits his max difference. Anything else unresolved goes to the "Eligibility unclear" group.

## 10. Dedupe

Two jobs are the same when any of these match:
1. Same `canonicalUrl`.
2. Same ATS type and ATS job id.
3. Same normalized company name + normalized title + similar location, and posted within 14 days of each other. Normalization: lowercase, strip punctuation, remove "Inc", "Ltd", "LLC", "GmbH"; titles drop seniority-neutral noise like "(Remote)".

Keep the highest tier; merge in missing fields (for example salary from a board when the ATS omits it, tagged `source: board`).

## 11. Staffing agencies

Agencies often repost the same role many times. Flag a company as a staffing agency when the LLM (P4) says so with reasons, or when it is in `data/staffing-agencies.json`. Hidden by default; shown with a toggle.

## 12. Salary

- Prefer structured fields (Ashby compensation, JSON-LD `baseSalary`, board salary fields).
- Otherwise parse from description text with a tested parser (ranges like "$120k to $150k", "USD 6,000/month", "€70.000"). Never let the LLM invent salary; it may only extract numbers that appear in the text, and the parser checks that the numbers exist in the source text.
- Convert to approximate annual USD with daily exchange rates from a free ECB-based rates API (for example frankfurter.app, verify it is still free) cached for 24 hours. Label the converted figure "approx." in the UI.

## 13. Etiquette and failure handling

- User-Agent: `OurJob/<version> (+<repo url>)`.
- Max 1 request/second per host (stricter where a source asks: Workable 1 per 3 s, Remotive max 4 runs a day).
- Retries: 3 with exponential backoff and jitter on 429 and 5xx; respect `Retry-After`.
- A failing source or company is logged in `pipeline_runs.errors` and skipped. After 5 consecutive failures, a company is paused and shown in the Companies screen.
- Cache raw responses per run so a crash and rerun does not refetch.
