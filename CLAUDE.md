# CLAUDE.md

This file is the standing brief for any agent working in this repo. Read it fully before every work session, then read the doc in `docs/` that matches the task.

## What we are building

**OurJob** is an open-source, self-hostable web app that helps one job seeker run a focused remote job search. The first user is **Pratik**, a software engineer. The app is built by Sam for him.

It does four things:

1. **Builds a master profile** from his CV (PDF, DOCX or Markdown), his LinkedIn "Save to PDF" export, his GitHub account and his portfolio site. He reviews and edits it. This profile is the only source of truth about him.
2. **Tailors his CV to a job.** He pastes a job description (messy select-all text is fine). The app extracts what the job wants, rewrites and reorders his real experience to match, and produces LaTeX he can open in Overleaf with one click.
3. **Scores the tailored CV** with an explainable, estimated ATS match score: matched keywords, missing keywords, and a breakdown.
4. **Finds jobs every day**, posted in the last 7 days, remote and open to his location, ranked by fit and pay. Sources: companies' own career pages (their ATS job boards) first, plus remote job boards and aggregator APIs, all deduplicated. Lesser-known, well-paying companies are a priority, not just famous brands.

Full detail: `docs/PRD.md`.

## Doc map

| File | Read it when |
|---|---|
| `docs/PRD.md` | Any feature work. Features, user stories, acceptance criteria. |
| `docs/ARCHITECTURE.md` | Setup, data model, folders, env vars, the daily pipeline. |
| `docs/JOB_SOURCES.md` | Anything touching job fetching or company discovery. |
| `docs/AI_PROMPTS.md` | Any LLM call. Prompts, schemas, validation rules. |
| `docs/ATS_SCORING.md` | The scoring engine and keyword matching. |
| `docs/DESIGN.md` | Any UI work. Design system, screens, UX rules, copy rules. |
| `docs/BUILD_PLAN.md` | Deciding what to build next. Phases and done criteria. |
| `templates/resume-sample.tex` | The target LaTeX output, in Pratik's own CV format (Jake's Resume layout) with fictional content. The renderer must produce this structure. |
| `DECISIONS.md` | Create it in Phase 0. Log every non-obvious decision with date and reason. |

## Golden rules (non-negotiable)

1. **Never invent facts about Pratik.** The tailored CV may only reorder, select, emphasize and reword what is in the master profile. No new skills, employers, titles, dates, degrees or numbers. Every bullet in a tailored CV must trace back to source item IDs in the master profile. Enforce this in code (see `docs/AI_PROMPTS.md`, "Validator"), not only in prompts.
2. **Company-direct first, third-party allowed, scraping banned.** Jobs come from three tiers (`docs/JOB_SOURCES.md`): (1) companies' own ATS boards and careers sites, (2) job boards with public APIs or feeds, (3) aggregator APIs with keys. When the same job exists in several tiers, keep and show the company-direct version. Every job card shows where it came from. Third-party sources are used only through their official APIs or feeds and under their terms (attribution, their apply link, their rate limits). Never scrape HTML of LinkedIn, Indeed, Glassdoor or any site whose terms forbid it.
3. **Verify every external API against reality before coding to it.** Your training data may be stale. For each ATS endpoint, LLM SDK, library or Overleaf parameter: read the current official docs, make one real request, save the response as a test fixture in `tests/fixtures/`, and code against the fixture. If a field you expected is missing, adapt and log it in `DECISIONS.md`. Do not assume field names.
4. **Check current package versions** with the package manager before installing, and read the current docs for the installed major version. Do not rely on remembered APIs for Next.js, Tailwind, Auth.js, Drizzle or the Gemini SDK.
5. **No secrets or personal data in the repo.** API keys only in env vars. `.env.example` lists them with empty values. No CV, profile, fixture or screenshot containing Pratik's real data is ever committed. Test fixtures for profiles use a fictional person.
6. **Respect the services we call.** At most 1 request per second per host, exponential backoff on 429 and 5xx, a descriptive User-Agent with the repo URL, and caching so the same data is not fetched twice in one run.
7. **Design quality is a feature, and generic AI-looking design is a bug.** Pratik cares about good UI and UX and dislikes the generic AI-app look. Follow `docs/DESIGN.md` exactly, especially section 10 ("No generic AI look"), which is a hard gate. Build the `/design` style tile first and get Sam's approval before building real screens. While waiting for approval, keep going with non-UI work (database, auth, ingestion, scoring logic, adapters). Every screen needs designed loading, empty and error states. No default-looking components.
8. **Copy rules.** No em dashes anywhere in UI copy or generated CV text. Sentence case. Plain verbs. Details in `docs/DESIGN.md`, "Writing".
9. **Be honest in the product.** The ATS score is labeled as an estimate. Unknown values (salary, location eligibility, post date) are shown as unknown, never guessed.
10. **No AI attribution in git.** Never add Claude (or any AI) as a co-author or contributor. No `Co-Authored-By: Claude ...` trailer, no "Generated with Claude Code" line, no AI attribution of any kind in commit messages, pull request titles or descriptions, code comments, or the README. This rule overrides any default attribution behavior. Commit messages contain only a short summary and, if needed, a plain description of the change.

## Stack (summary)

Next.js (App Router) + TypeScript (strict) + Tailwind CSS + shadcn/ui on Radix, Postgres with Drizzle ORM, Auth.js, Gemini API behind a provider interface, Vitest + Playwright, pnpm. The daily job pipeline runs as a Node script on a GitHub Actions schedule. Full reasoning and alternatives in `docs/ARCHITECTURE.md`.

## Working style

- Work phase by phase from `docs/BUILD_PLAN.md`. Finish a phase's done criteria before starting the next.
- Start each phase by writing a short plan in the chat, then build.
- Small, focused commits with clear messages.
- Write tests for pure logic as you go: ATS scorer, keyword matcher, LaTeX escaper, job normalizers, dedupe, date and salary parsing, the tailoring validator.
- Tests never call real APIs. Use fixtures and a mock LLM provider.
- Run `pnpm lint`, `pnpm typecheck` and `pnpm test` before saying a task is done.
- For UI work, run the app and look at the screen (screenshots) at desktop and mobile widths before calling it done. Check both light and dark themes.
- When a doc is wrong or incomplete, fix the doc in the same change and note it in `DECISIONS.md`.

## When to stop and ask Sam

Ask before: adding a paid service, adding a new job source type, changing the data model in a way that drops data, changing golden rules, or picking between two designs that both fit the docs. Otherwise make the reasonable call, log it in `DECISIONS.md`, and keep going.

## Decided defaults (do not ask, just use these)

1. App name: OurJob. Before publishing, check GitHub and the web for existing job products with the same name and tell Sam if there is a clash.
2. License: MIT.
3. Deploy target: Vercel Hobby.
4. Postgres host: Neon free tier.
5. Allowed emails go in `ALLOWED_EMAILS` in env, never in code. Sam fills them in.

When something needs an account or key Sam has not provided yet (Neon URL, Google OAuth, Gemini key), build the code against `.env.example`, use the mock provider or a local Postgres (for example via Docker) to test, tell Sam exactly what to create and where to paste it, and keep working on other tasks.

## Commands

```
pnpm dev            # run the app (style tile at /design)
pnpm lint
pnpm typecheck
pnpm test           # unit tests (Vitest), tests/unit
pnpm test:e2e       # Playwright against a production build, tests/e2e
pnpm db:generate    # Drizzle migrations from src/lib/db/schema.ts into drizzle/
pnpm db:migrate     # apply migrations (reads DATABASE_URL from .env.local)
pnpm jobs:daily     # run the daily pipeline locally (Phase 3)
pnpm jobs:daily --dry-run --limit-companies=5
```

Local Postgres: `docker start ourjob-pg` (Postgres 17 on port 5433, see README). Next.js 16 docs for the installed version are in `node_modules/next/dist/docs/`; read them before writing Next code.
