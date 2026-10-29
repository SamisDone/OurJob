# Build plan

Build in phases. Each phase ends with its done criteria met, tests passing, and a short summary to Sam (what works, what changed from the docs, open issues). Do not start a phase until the previous one is done.

## Phase 0: foundation and style tile

- Use the decided defaults in `CLAUDE.md`; do not wait for confirmation to start.
- Scaffold Next.js (App Router, TypeScript strict), Tailwind, shadcn/ui, ESLint, Prettier, Vitest, Playwright, pnpm.
- `tokens.css` with every token from DESIGN.md section 3, light and dark; fonts via `next/font`.
- Restyle the base primitives (Button, Input, Textarea, Chip, Tabs, Dialog, Sheet, Toast, Tooltip, Skeleton) to the tokens.
- `/design` style tile (DESIGN.md 10.3), including a working highlighter sweep on sample text and the CV sheet with sample fictional content.
- Drizzle setup, all tables from ARCHITECTURE section 3, first migration.
- Auth.js with Google and `ALLOWED_EMAILS`.
- App shell (rail, mobile bar, command palette skeleton).
- `DECISIONS.md`, `README.md` stub, `.env.example`, CI workflow (lint, typecheck, test).

**Done when:** CI is green; sign-in works with an allowed email and refuses others; `/design` passes DESIGN.md section 10 checks in both themes at 1440 and 390 px; **Sam has approved the style tile** (keep doing non-UI work while waiting; do not start real screens before approval).

## Phase 1: profile

- Ingestion: PDF, DOCX, MD, LinkedIn PDF, GitHub, portfolio (with SSRF guard).
- LLM provider interface, Gemini implementation, mock provider, `llm_cache`.
- P1 extraction and merge, P5 search profile suggestion.
- Onboarding steps 1 to 4.
- Profile editor with source badges, conflicts, versions and restore.
- Search preferences UI.
- Fictional fixtures: 3 CVs (one PDF, one DOCX, one MD), 1 LinkedIn-style PDF, 1 GitHub API response set.

**Done when:** each fixture CV produces a complete profile (checked against hand-written expected profiles in tests); conflicts show and resolve; editing saves a new version; onboarding works end to end with the mock provider and once with the real provider.

## Phase 2: tailoring, LaTeX, Overleaf, ATS score

- JD cleaner and P2 parser with substring checks.
- ATS keyword matcher and scoring engine (ATS_SCORING) with all listed tests.
- P3 tailoring, validator, fix loop, "Removed for accuracy" panel.
- LaTeX renderer and escaper matching `templates/resume-sample.tex`.
- Open in Overleaf (verify parameters at overleaf.com/devs first), Copy, Download.
- Tailor workspace UI with all three columns, the highlighter sweep, Changes diff, inline bullet edit, "I have this" gap flow, re-tailor options.
- Tailoring history.
- `pnpm eval:prompts`.

**Done when:** for 10 fictional JDs: zero gap leaks, zero unsupported numbers, all matched keywords present; 5 rendered `.tex` files compile with pdflatex locally and open and compile in Overleaf; score is deterministic; the workspace passes DESIGN.md section 10 at all widths and both themes.

## Phase 3: job sources and daily feed

- Polite HTTP client (rate limit per host, retries, UA, cache).
- Tier 1 adapters: Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, each with a saved real fixture and tests.
- Tier 2 adapters: Remotive, Himalayas, RemoteOK, Jobicy, Arbeitnow, We Work Remotely RSS, HN "Who is hiring?" (P6). Read and follow each one's terms; record them in `DECISIONS.md`.
- Tier 3 adapters: Adzuna, JSearch (only active with keys).
- ATS detection and apply-link resolution to tier 1.
- Normalization, sanitizing, dedupe with tier preference, dates and the 7-day rule, eligibility rules, salary parse and FX, staffing agency flag.
- Prefilter, P4 batch scoring with budget, feed ranking.
- `scripts/daily-jobs.ts` with flags; GitHub Actions `daily-jobs.yml`; "Run now" via `workflow_dispatch`.
- Today screen, job detail, pipeline health header and warning, empty and error states, keyboard shortcuts.
- Companies seed import (remoteintech directory and `data/companies.seed.json`).
- Storage housekeeping for Neon's 1 GB free limit. At the end of each run the pipeline: deletes jobs older than 90 days that are closed (`closed_at` set) or dismissed, except any job linked to a tailoring (`tailorings.job_id`) or to a tracker card (a match in Saved, Applied, Interviewing, Offer or Closed); trims raw source payloads once a job is normalized, keeping only the normalized columns; and deletes the run's raw response caches. Settings shows the database size (`pg_database_size`) and a warning above 800 MB.

**Done when:** a real run completes in under 15 minutes, finds jobs from at least 3 tier 1 ATS types and at least 3 tier 2 sources, every shown job is within 7 days with a reliable date, no duplicates across sources in a manual check of 30 jobs, eligibility groups are correct in a manual check of 30 jobs, the run stays within the free-tier budget table, and a second consecutive run marks only truly new jobs as new.

## Phase 4: company discovery and quality

- Companies screen with add, detect, confirm, mute, pause.
- `careers-jsonld` adapter.
- Weekly remoteintech re-sync.
- Well-known list and lesser-known boost; "New company" chip.
- Pipeline stats view in Settings (per source counts and errors for the last 14 runs).

**Done when:** at least 50 companies are tracked that were discovered automatically (not seeded), with ATS matches confirmed or flagged; adding a careers URL by hand detects the ATS in under 10 seconds for the 6 tier 1 types.

## Phase 5: tracker and polish

- Tracker board with drag and drop plus keyboard alternative, notes, links to tailored CVs.
- Command palette complete.
- Data export and delete.
- Onboarding step 5 (live first search).
- README with screenshots, a self-host guide (accounts to create, env vars, GitHub secrets, deploy), and a contributor guide for adding companies and sources.
- Full accessibility pass and Lighthouse pass (performance and accessibility 90+).
- Final design pass: DESIGN.md section 11 on every screen.

**Done when:** a new person can self-host from the README alone in under an hour; all PRD acceptance criteria pass; Sam and Pratik sign off.

## Later (not v1)

Cover letters from the same profile and job spec, interview prep notes per job, email digest of the morning feed, XeLaTeX variant for non-Latin scripts, a browser extension to send a job page to the Tailor screen.
