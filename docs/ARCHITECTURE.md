# Architecture

## 1. Stack and why

| Concern | Choice | Why | Notes |
|---|---|---|---|
| App framework | Next.js, App Router, TypeScript strict | One codebase for UI and server routes; Sam knows it. | Use server components for data pages, server actions or route handlers for mutations. Check the current major version's docs. |
| Styling | Tailwind CSS + CSS variables for design tokens | Tokens from `DESIGN.md` live in one place. | |
| Components | shadcn/ui (Radix primitives), restyled to our tokens | Accessible primitives, full control of look. | Never ship shadcn defaults unchanged. |
| Motion | Motion (formerly Framer Motion) | For the few purposeful animations in `DESIGN.md`. | |
| Client data | TanStack Query v5 (`@tanstack/react-query`, 5.105 at setup) | Caching, optimistic updates with rollback, and mutation state for progress UI, on top of App Router routing. | Server components prefetch and hydrate; see section 4a. |
| Database | Postgres (Neon free tier default; Supabase works) | Relational data, JSONB for profiles. | |
| ORM | Drizzle ORM + drizzle-kit migrations | Typed SQL, light. | |
| Auth | Auth.js with Google sign-in, allowlist via `ALLOWED_EMAILS` | Single-owner deployments, no passwords to store. | Every page and route except sign-in requires a session. |
| LLM | Gemini API through a `LLMProvider` interface | Free tier for one user. | Interface allows OpenAI-compatible or Anthropic providers later. Model id from env. |
| Validation | Zod | Validate every LLM output and every source response. | |
| File parsing | `unpdf` or `pdf-parse` for PDF, `mammoth` for DOCX | Text only. | Pick by testing on 3 sample CVs; log choice in DECISIONS.md. |
| HTML sanitizing | `sanitize-html` or DOMPurify (isomorphic) | Job descriptions are untrusted HTML. | |
| Daily pipeline | Node script (`tsx`) run by a GitHub Actions scheduled workflow | No serverless time limits; free for public repos (verify current GitHub terms). | Vercel Cron is the fallback (see section 8). |
| Tests | Vitest (unit), Playwright (e2e), MSW for HTTP mocks | | |
| Package manager | pnpm | | |
| Hosting | Vercel Hobby (default) | Free, Next.js native. | Hobby is for personal, non-commercial use; verify current terms. |

## 2. Repo layout

```
.
├── CLAUDE.md
├── DECISIONS.md
├── README.md                 # user-facing: what it is, self-host guide
├── .env.example
├── .github/workflows/
│   ├── ci.yml                # lint, typecheck, test on PRs
│   └── daily-jobs.yml        # scheduled pipeline
├── data/
│   ├── companies.seed.json
│   ├── well-known-companies.json
│   ├── staffing-agencies.json
│   └── skill-synonyms.json   # base synonym map, see ATS_SCORING.md
├── docs/
├── templates/
│   └── resume-sample.tex
├── scripts/
│   └── daily-jobs.ts         # pipeline entry
├── src/
│   ├── app/                  # routes (see DESIGN.md for screens)
│   │   ├── (auth)/sign-in/       # no shell
│   │   ├── design/               # dev-only style tile, no shell, 404 in production
│   │   ├── (app)/                # every signed-in page: one layout with the app shell
│   │   │   ├── layout.tsx        # requireUser, rail cookie, AppShell
│   │   │   ├── not-found.tsx     # signed-in 404, inside the shell
│   │   │   ├── [...missing]/     # unknown URLs -> notFound() -> the 404 above
│   │   │   └── (screens)/        # loading.tsx lives here (see below)
│   │   │       ├── today/
│   │   │       ├── tailor/
│   │   │       ├── tailor/[id]/
│   │   │       ├── jobs/[id]/
│   │   │       ├── tracker/
│   │   │       ├── companies/
│   │   │       ├── profile/
│   │   │       ├── settings/
│   │   │       └── onboarding/
│   │   └── api/
│   ├── components/           # ui/ (restyled primitives), feature components
│   ├── lib/
│   │   ├── db/               # drizzle schema, queries
│   │   ├── auth/
│   │   ├── llm/              # provider interface, gemini impl, mock impl, prompts/
│   │   ├── ingest/           # pdf, docx, md, linkedin pdf, github, portfolio
│   │   ├── profile/          # master profile types, merge, diff, versioning
│   │   ├── jd/               # clean + parse job descriptions
│   │   ├── tailor/           # tailoring orchestration + validator
│   │   ├── latex/            # renderer + escaper
│   │   ├── ats/              # scoring engine + keyword matcher
│   │   ├── sources/          # one folder per adapter + ats-detect
│   │   ├── pipeline/         # fetch, normalize, dedupe, eligibility, rank
│   │   ├── salary/           # parse + fx
│   │   └── http/             # polite fetch: rate limit, retry, UA, cache, SSRF guard
│   └── styles/tokens.css
└── tests/
    ├── fixtures/             # sources/, cvs/ (fictional), jds/, llm/
    ├── unit/
    └── e2e/
```

Signed-in routes:
- Every signed-in page sits under `(app)`, whose one layout renders the app shell (rail, phone bottom bar, command palette, account menu with Sign out). The layout stays mounted across navigation, so the shell never re-mounts or flashes. Only `/sign-in` and the dev-only `/design` are outside it.
- Onboarding is inside the shell too. Pages that need a confirmed profile (Today, Tailor, Tracker, Companies and their detail pages) never redirect: they render an empty state that says why and links back into onboarding (`NeedsProfile`, `src/components/shell/page-states.tsx`). Screens not built yet render `ComingSoon`.
- The rail's collapsed state is a cookie (`ourjob-rail`) read by the layout, so the server renders the right width and nothing shifts on load.
- `loading.tsx` sits in `(app)/(screens)`, not `(app)`: a loading boundary starts streaming the response with status 200 before the page runs, and the signed-in 404 (`[...missing]`, outside that boundary) must answer with a real 404.

## 3. Data model (Postgres, via Drizzle)

All tables have `id` (uuid), `created_at`, `updated_at`. `user_id` on per-user tables even though deployments are single-owner, so the model stays clean.

**users**: email, name, image, `timezone`, `country` (ISO-2).

**profile_sources**: user_id, `kind` (cv_tex | cv_pdf | cv_docx | cv_md | linkedin_pdf | github | portfolio | notes), `original_filename`, `file_bytes` (bytea, nullable, max 5 MB), `extracted_text`, `meta` (jsonb: GitHub username, URL, page count), `fetched_at`.

**master_profiles**: user_id, `version` (int), `data` (jsonb, `MasterProfile` from AI_PROMPTS P1), `is_current` (bool), `confirmed_at`. New version on every save; keep all.

**search_preferences**: user_id, `data` (jsonb, fields from PRD F2).

**companies**: `name`, `normalized_name` (unique), `website`, `careers_url`, `ats_type`, `ats_slug`, `ats_verified` (bool), `discovered_via` (enum: board_apply_link | hn | remoteintech | seed | manual | aggregator), `is_staffing_agency` (bool), `is_well_known` (bool), `muted` (bool), `open_roles_count`, `last_crawled_at`, `crawl_count`, `consecutive_failures`, `paused`.
Unique index on (`ats_type`, `ats_slug`).

**jobs**: `company_id`, `source`, `tier`, `source_job_id`, `title`, `normalized_title`, `description_html` (sanitized), `description_text`, `apply_url`, `canonical_url`, `location_raw`, `workplace`, `remote_scope` (jsonb), `employment_type`, `salary` (jsonb), `posted_at`, `posted_at_source`, `first_seen_at`, `last_seen_at`, `closed_at`, `attribution` (jsonb), `also_seen_in` (jsonb array of {source, url}), `content_hash`.
Unique index on (`source`, `source_job_id`). Index on `posted_at`, `canonical_url`.

**job_matches**: user_id, job_id, `prefilter_score`, `fit_score` (0 to 100), `fit_reasons` (jsonb), `gaps` (jsonb), `eligibility` (eligible | unclear | ineligible), `status` (new | seen | saved | dismissed | applied | interviewing | offer | closed), `notes`, `scored_at`, `model`.

**tailorings**: user_id, job_id (nullable), `jd_raw`, `jd_clean`, `job_spec` (jsonb, P2), `tailored` (jsonb, P3 output after validation), `validator_report` (jsonb), `latex`, `ats_master` (jsonb score), `ats_tailored` (jsonb score), `options` (jsonb), `profile_version`.

**pipeline_runs**: `started_at`, `finished_at`, `trigger` (schedule | manual), `stats` (jsonb: per source fetched/new/errors, companies crawled, jobs scored, LLM calls), `errors` (jsonb array), `status`.

**llm_cache**: `key` (hash of prompt id + model + input), `output` (jsonb), `created_at`. Avoids paying twice for the same job.

## 4. Ingestion

- **LaTeX CV (`.tex`, preferred for Pratik):** structural parse as described in AI_PROMPTS ("Importing his current `.tex` CV"). Unit-test the parser on `templates/resume-sample.tex`.
- **PDF / DOCX / MD CV:** extract text, keep reading order, keep line breaks. Reject scanned PDFs with no text layer with a clear message ("This PDF has no selectable text. Upload the DOCX or a text-based PDF.").
- **LinkedIn PDF:** same as PDF. LinkedIn's export has a predictable layout (contact, top skills, experience); the LLM handles it, no custom parser needed.
- **GitHub:** REST API: user profile, public repos (non-fork, sorted by pushed date, top 20), languages per repo, README for the top 8 by stars or recent activity (first 4,000 characters each), pinned repos if obtainable. Unauthenticated rate limits are low; support optional `GITHUB_TOKEN`. The LLM turns this into project entries, clearly marked `source: github`.
- **Portfolio URL:** server-side fetch with the SSRF guard (block private, loopback and link-local IPs, max 3 redirects, 2 MB limit, 10 s timeout). Extract main text (for example with `@mozilla/readability` + `linkedom`). If under 300 characters of text, tell him the site likely renders in the browser and offer a paste box.
- **Merge:** P1 runs once over all sources together, producing one `MasterProfile` with item-level `sources` and a `conflicts` list.

## 4a. Client data (TanStack Query)

Next.js App Router does routing and the first load; TanStack Query owns data on the client after that.

- **Setup:** `src/lib/query/client.ts` makes the client: `staleTime` 60 s, query retry 1, mutation retry 0, pending queries dehydrated (so server prefetches can stream), server errors not redacted (Next.js uses them to detect dynamic rendering). On the server every request gets a fresh client; in the browser one client is shared. `QueryProvider` is mounted inside the app shell.
- **First page from the server:** a server component calls `serverQueryClient().prefetchQuery(...)` with the same key and query function as the client hook, and wraps the client part in `<Hydrate client={qc}>` (`src/lib/query/hydrate.tsx`). The client reads the hydrated cache instead of refetching. Server components only prefetch; they never render query data themselves.
- **Keys:** every query and mutation key lives in `src/lib/query-keys.ts`. Feed filters are part of the feed key and are normalized (defaults filled, empty values dropped, arrays sorted) so equivalent filters share a cache entry. Keys go from general to specific, so `["feed"]` covers every filtered list.
- **Queries:** Today feed (filters in the key), pipeline status, companies, tracker board, tailoring history and detail, profile and preferences. Queries in the tailor workspace use `tailorWorkspaceQueryOptions` (`refetchOnWindowFocus: false`), so coming back to the tab never refetches mid-edit.
- **Mutations with optimistic updates:** save, dismiss, mark applied, tracker moves and profile edits use `useOptimisticMutation` (`src/lib/query/hooks.ts`): cancel in-flight fetches of the target keys, snapshot, apply the change, roll back on error, invalidate when settled. Dismiss and status changes show the toast with Undo, which runs the inverse mutation.
- **Tailoring progress:** parse and tailor are mutations with fixed mutation keys. `useTailorProgress()` reads their state with `useMutationState` and maps it to the "Reading the job" and "Tailoring your CV" steps, so any component can show progress.
- **Mutations call route handlers**, not server actions, for anything a query reads back: server actions run one at a time from the client and must not be used as query functions.

## 5. Tailoring pipeline

```
paste JD
  -> clean (rules: drop lines like "Apply now", "Share", cookie text, nav lists; collapse whitespace)
  -> P2 parse  -> JobSpec (Zod-validated)       [cache by hash of clean JD]
  -> (optional) user edits JobSpec
  -> keyword availability: match JobSpec keywords against MasterProfile (ATS matcher)
       -> matched keywords (must include) / gaps (must not include)
  -> P3 tailor (MasterProfile + JobSpec + matched list + options) -> TailoredResume
  -> Validator (deterministic, see AI_PROMPTS) -> fix loop (max 2 retries) -> drop failing items
  -> LaTeX renderer (deterministic) -> .tex string
  -> ATS score (master vs tailored)
  -> save tailoring
```

Run parse and tailor as separate requests from the client so each server call stays short and the UI can show progress per step. Stream the tailoring call if the provider supports it. Check Vercel Hobby's current function duration limit and keep each step well under it.

## 6. LaTeX renderer

- Input: `TailoredResume` plus the master profile (for names, titles, dates, links). Output: one self-contained `.tex` file that compiles with pdflatex and only uses packages available on Overleaf by default.
- **Format:** Pratik's own CV format, reproduced in `templates/resume-sample.tex` (Jake's Resume layout, MIT License, attribution kept). Preamble and macros are copied verbatim; the renderer only fills the body. That file was compiled with pdflatex and fits one page with clean text extraction.
- Mapping: header from `basics` (name, location, email, phone if present, links rendered as `\lnk{url}{Github}` style labels joined with `$|$`); each role is `\resumeSubheading{\lnk{companyUrl}{Company}}{Title}{Mon YYYY -- Mon YYYY}` (use `\underline{Company}{}` when there is no URL) followed by `\resumeItem` bullets and a `\tech{...}` line; each project is `\resumeProjectHeading{\textbf{Name}}{\lnk{live}{Live} $|$ \lnk{source}{Source}}`; education is `\resumeSubheading{Institution}{Degree}{Location or dates}`; skills are grouped lines `\textbf{Group}{: a, b, c}` with two short groups per line joined by ` $|$ `.
- Bold: wrap each `boldPhrases` substring in `\textbf{}` after escaping, matching on the escaped text.
- Section titles: "Summary", "Technical Skills", "Professional Experience", "Projects", "Education" (his wording).
- **Template setting (later):** let a user upload their own `.tex` and use its preamble and macros as their house template, as long as it uses the same macro names. Out of scope for v1 unless trivial.
- **Escaping:** every user string goes through `escapeLatex()`: `\` to `\textbackslash{}`, `&` `%` `$` `#` `_` `{` `}` to escaped forms, `~` to `\textasciitilde{}`, `^` to `\textasciicircum{}`, straight quotes to proper quotes, en dash for ranges as `--`. URLs go in `\href{}` with `%` and `#` escaped. Unit-test all of these plus non-ASCII Latin letters (é, ü, ñ).
- **Font encoding:** the template is used exactly as Pratik has it: no `fontenc` (so OT1 Computer Modern) and no `inputenc` line (LaTeX reads UTF-8 by default since 2018). The renderer never adds packages to the preamble. Non-ASCII Latin letters are handled in `escapeLatex()`, which maps each one to its LaTeX accent or symbol command (`é` to `\'{e}`, `ü` to `\"{u}`, `ñ` to `\~{n}`, `ç` to `\c{c}`, `ß` to `\ss{}`, `ø` to `\o{}`, `ł` to `\l{}`, `í` to `\'{\i}`, and so on), so the output does not depend on the input encoding. Known trade-off: with OT1, an accented letter is a base glyph plus a separate accent, so PDF text extraction (and so ATS parsing) splits it ("José" extracts as "Jos´e"). Plain ASCII text is unaffected. The ATS parseability check notes accented letters in the CV.
- Characters with no LaTeX command mapping in `escapeLatex()` (for example Bangla script) are not expected in an English CV; if present, warn in the UI and offer an XeLaTeX variant later (out of scope v1).
- ATS-friendliness built into the template: single column, real text (no icons or images), standard section names, `\pdfgentounicode=1` so text copies and parses correctly.

## 7. Overleaf

Use Overleaf's documented "Open in Overleaf" interface. Create a form in the browser and submit it in a new tab:

```html
<form action="https://www.overleaf.com/docs" method="post" target="_blank">
  <input type="hidden" name="encoded_snip" value="<encodeURIComponent(tex)>" />
  <input type="hidden" name="snip_name" value="resume.tex" />
</form>
```

- POST, not GET, because a CV is too long for a URL.
- Overleaf's docs also describe `snip_uri` (a URL or a base64 data URL) and multi-file uploads via `snip_uri[]`. Their docs page also lists options such as the compiler engine and main document; check the current parameter names at overleaf.com/devs before using any.
- This creates a new project in whatever Overleaf account he is signed in to. It works with free accounts. We never handle Overleaf credentials.
- Also offer Copy LaTeX and Download `.tex`.

## 8. Daily pipeline

**Schedule:** `.github/workflows/daily-jobs.yml`, cron in UTC, default `30 0 * * *` (06:30 in Dhaka). Also `workflow_dispatch` so the app's "Run now" button can trigger it through the GitHub API (needs a fine-grained `GITHUB_DISPATCH_TOKEN` with Actions write on this repo only).

GitHub caveats to verify and handle: scheduled runs can start late at busy times, and scheduled workflows in public repos may be disabled after a long period with no repository activity. The feed header's "last run" warning (PRD F5) covers both.

**Steps (scripts/daily-jobs.ts):**
1. Open a `pipeline_runs` row.
2. Load the current profile, search preferences, and company list.
3. Fetch tier 1 (company boards in the crawl budget), tier 2 (boards and HN), tier 3 (if keys set) concurrently with per-host limits.
4. Normalize, sanitize, store raw page cache.
5. Resolve tier 2/3 apply links to ATS boards; add new companies; fetch their boards in the same run (cap 50 new companies per run).
6. Dedupe and upsert jobs; mark missing ones closed.
7. Date filter (7 days, rules in JOB_SOURCES section 8).
8. Eligibility rules (structured + string rules).
9. Prefilter score (cheap, deterministic): title similarity to target titles, skill overlap with profile, seniority words, exclusions. Keep the top 60 new jobs.
10. LLM scoring P4 in batches of 5 jobs per call; cache by job content hash. Stop when the daily LLM budget is used (`LLM_DAILY_CALL_BUDGET`, default 40).
11. Write `job_matches`, finish the run row with stats.

The script must support `--dry-run`, `--limit-companies=N`, `--source=greenhouse`, and log a clear summary.

**Fallback (no GitHub Actions):** a Vercel Cron route `POST /api/cron/daily` protected by `CRON_SECRET` that processes one stage per invocation and stores progress in `pipeline_runs`, so no single call runs long. Vercel Hobby cron runs at most once a day and its exact firing time can drift within the hour, so pair it with an external free scheduler if more runs are needed. Build this only if Sam asks.

## 9. LLM provider

```ts
interface LLMProvider {
  name: string;
  generateJSON<T>(args: {
    promptId: string;          // for caching and logging
    system: string;
    user: string;
    schema: z.ZodType<T>;      // converted to the provider's JSON schema format
    temperature?: number;
    maxOutputTokens?: number;
  }): Promise<{ data: T; usage: { inputTokens: number; outputTokens: number } }>;
}
```

- Gemini implementation uses the official Google Gen AI SDK for JavaScript (check the current package name and structured-output API in Google's docs). Model id from `LLM_MODEL`; choose a model that is listed as free-tier eligible on Google's pricing page at build time.
- Retries on 429 with backoff; respect per-minute limits with a small token bucket.
- Mock provider for tests reads `tests/fixtures/llm/<promptId>/<hash>.json` (an exact recording of the prompt, written by the recording provider during `pnpm eval:prompts --record`), and otherwise the first fixture in that folder whose `match` strings all appear in the prompt, so fixtures survive prompt wording changes.
- Model: `LLM_MODEL` (default `gemini-3.5-flash-lite`), with `LLM_FALLBACK_MODEL` (default `gemini-3.8-flash`) tried when the main model keeps answering 503 or 429. A 429 for a per-day quota is not retried; it goes straight to the fallback. When the main model has not answered after `LLM_SLOW_MS` (default 10 s), a second request goes to `LLM_MODEL` (lite) as well and the first answer wins; the other request is cancelled. Flash is no longer the slow-answer hedge: its free quota is 20 calls a day. Busy errors (429, 503) still go to the fallback. If the second request fails, the first is still awaited. The SDK's own retries are turned off so a busy model cannot block a request for minutes. An optional `LLM_THOROUGH_MODEL` (suggested `gemini-3.8-flash`) is offered in Settings as the "Thorough" model for tailoring (stored per person in `users.tailor_model`). It writes the CV (P3 and fixes); the job post (P2) is always read by `LLM_MODEL`. When it is busy or out of daily quota, tailoring falls back to `LLM_MODEL`.
- Never log prompt inputs that contain CV text; log prompt id, token counts, latency.

## 10. Security

- Auth on every page and API route; allowlist check on sign-in. The proxy only reads the session token (`getToken`) and never re-issues the cookie, so a late request cannot undo a sign-out; sessions last a fixed 30 days.
- All job HTML sanitized on write; rendered through a whitelist renderer.
- SSRF guard for every user-supplied URL (portfolio, careers URL, add company).
- Rate limit tailoring endpoints (for example 30 per hour) to protect the free LLM quota.
- `CRON_SECRET` and `GITHUB_DISPATCH_TOKEN` are server-only.
- CSP headers; Overleaf form posts to `https://www.overleaf.com` only.
- Data export and delete in Settings.

## 11. Environment variables (`.env.example`)

```
# App
APP_URL=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ALLOWED_EMAILS=                 # comma separated

# Database
DATABASE_URL=

# LLM
LLM_PROVIDER=gemini
GEMINI_API_KEY=
LLM_MODEL=gemini-3.5-flash-lite
LLM_FALLBACK_MODEL=gemini-3.8-flash
LLM_THOROUGH_MODEL=gemini-3.8-flash
LLM_DAILY_CALL_BUDGET=40

# Sources (tier 3 optional)
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
JSEARCH_API_KEY=
JSEARCH_HOST=                   # rapidapi host or openwebninja base url
GITHUB_TOKEN=                   # optional, raises GitHub API limits for ingestion

# Pipeline
PIPELINE_MAX_COMPANIES=400
PIPELINE_NEW_COMPANIES_PER_RUN=50
GITHUB_DISPATCH_TOKEN=          # optional, for the Run now button
GITHUB_REPO=                    # owner/name
CRON_SECRET=                    # only for the Vercel cron fallback
```

The same `DATABASE_URL`, `GEMINI_API_KEY` and source keys are added as GitHub Actions secrets for the scheduled workflow.

## 12. Free tier budget (one user, per day)

| Resource | Use per day | Free allowance (reported Oct 2026, verify) |
|---|---|---|
| LLM calls, pipeline | up to 40 (batches of 5 jobs, so up to 200 jobs scored) | Gemini Flash-class free tiers were reported in the hundreds to low thousands of requests per day, varying by model |
| LLM calls, tailoring | 2 per tailoring, about 10 to 20 a day | same quota |
| Tier 1 requests | up to about 450 | No key; be polite |
| Remotive | 1 run | Max 4 a day per their terms |
| Adzuna | 20 calls | About 1,000 a month |
| JSearch | 5 calls | 200 a month, hard limit |
| GitHub Actions | 1 run, a few minutes | Free for public repos (verify) |

If the LLM quota runs out mid-run, remaining jobs are stored with prefilter scores only and labeled "Not scored yet"; the next run scores them first.

## 13. Testing

- Unit: `escapeLatex`, renderer snapshot vs `templates/resume-sample.tex` structure, ATS matcher edge cases (see ATS_SCORING), salary parser, date rules, eligibility rules, dedupe, URL canonicalization, ATS detection patterns, validator.
- Adapter tests: each adapter normalizes its saved fixture into the expected `NormalizedJob`s.
- LLM: prompts run against the mock provider in CI. A separate `pnpm eval:prompts` script runs real calls on 5 fictional CVs and 10 sample JDs and prints validator results; run it manually before changing prompts.
- Private evals with real data: `tests/private/` is git-ignored. Sam can drop Pratik's real `.tex` and sample JDs there to run `pnpm eval:prompts --private` locally. Nothing from that folder is ever committed, logged to CI or used in snapshots.
- E2E (Playwright, mock LLM, seeded DB): onboarding, tailor flow to Overleaf form contents, feed filter/save/dismiss, tracker drag.
- LaTeX compile check in CI: install a minimal TeX Live (or use a container image) and compile 5 rendered outputs with pdflatex. If CI setup is too heavy, do it as a manual script and note in DECISIONS.md.
