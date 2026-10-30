# Decisions

Non-obvious decisions, newest last. Each has a date and a reason.

## 2026-10-28: Phase 0

### Stack versions (checked with npm on 2026-10-28)
Next.js 16.4.3, React 19.3, Tailwind CSS 4.3.3, next-auth 5.0.0-beta.32 (Auth.js v5, still published as beta; its peer range includes Next 16), drizzle-orm 0.45.4, drizzle-kit 0.31.11, Zod 4.6, Vitest 5.0, Playwright 1.64, pnpm 10.13. TypeScript stays on 5.9: create-next-app pinned `^5`, and TypeScript 7 (the native rewrite) has not been tested with Next's plugin here.

### Next.js 16 conventions that differ from older docs
- Middleware is called Proxy in Next 16 (`src/proxy.ts`). Auth.js's `auth` is exported as the proxy's default export.
- Next 16 ships its own docs in `node_modules/next/dist/docs/`; they were read before writing routing, fonts and auth code.
- `cacheComponents` is **off**. Every page here is per-user and reads the session, so with Cache Components each page would have to wrap the session read in Suspense and opt out of instant navigation. Plain dynamic rendering is simpler and fast enough for one user. Revisit if we ever add public pages.
- Tailwind is wired through `@tailwindcss/turbopack` (what create-next-app 16.4 generates), not a PostCSS config.

### shadcn/ui: primitives written by hand in the shadcn pattern
The shadcn 4.23 CLI only offers stock presets (Nova uses Lucide and Geist, both banned by DESIGN.md 10.1). Instead of generating stock components and restyling them, the primitives in `src/components/ui/` are written in the shadcn pattern directly: Radix primitives from the `radix-ui` package, `cva` variants and a `cn` helper, styled only with our tokens. There is no `components.json`, so `shadcn add` cannot silently add a default-looking component.

### Tailwind theme is cleared
`globals.css` resets `--color-*`, `--text-*`, `--radius-*`, `--shadow-*`, `--font-*` and `--ease-*` before defining ours. Stock classes like `bg-zinc-100`, `rounded-lg` or `text-3xl` do not exist, so the default look cannot creep in. Radii are named by role: `rounded-control` (8), `rounded-panel` (12), `rounded-sheet` (2), `rounded-pill`.

### Tokens added beyond DESIGN.md section 3
All are derived from the spec colors or exist for a stated need:
- `--highlight-ink` (#1A2233): text on a highlighter mark in both themes, as the spec says.
- `--caution-wash`, `--proofmark-wash`, `--ink-wash`: light tints mixed from the spec colors for the warning bar, error panel and hover fills.
- `--cv-paper` (#FFFFFF), `--cv-ink` (#000000), `--cv-rule`: the CV stays paper in both themes.
- `--scrim`: dialog overlay.
- `--control-edge` (light #828C9D, dark #626E86): see contrast below.

### Contrast (WCAG 2.2 AA)
Computed with `src/lib/design/contrast.ts` and enforced by `tests/unit/design/tokens.test.ts`.

| Pair | Use | Light | Dark |
|---|---|---|---|
| --ink on --paper | text | 14.55 | 15.11 |
| --ink on --sheet | text | 15.90 | 13.96 |
| --graphite on --paper | secondary text | 5.46 | 7.09 |
| --graphite on --sheet | secondary text | 5.97 | 6.54 |
| --proofmark on --paper | text | 5.37 | 5.97 |
| --proofmark on --sheet | text | 5.87 | 5.51 |
| --ok on --paper | text | 4.62 | 8.45 |
| --ok on --sheet | text | 5.05 | 7.80 |
| --caution on --paper | text | 4.75 | 8.89 |
| --caution on --sheet | text | 5.19 | 8.20 |
| --sheet on --ink | primary button | 15.90 | 13.96 |
| --sheet on --proofmark | destructive button | 5.87 | 5.51 |
| #1A2233 on --highlight | text on a mark | 12.41 | 10.51 |
| --control-edge on --paper | field edge (needs 3:1) | 3.11 | 3.56 |
| --control-edge on --sheet | field edge (needs 3:1) | 3.39 | 3.29 |
| CV black on white | CV text | 21.00 | 21.00 |

`--rule` is 1.24 (light) and 1.39 (dark) against paper. That is fine for dividers, which carry no meaning on their own, but too faint for the edge of a text field (WCAG 1.4.11 needs 3:1). Hence `--control-edge` for inputs, selects and the segmented control only. Buttons, chips and rows keep `--rule` because their text identifies them.

### CV preview font: Latin Modern Roman
Latin Modern Roman 2.004 (GUST Font License, which allows redistribution) is the same design as the Computer Modern his template compiles to. The OTF files come from the TeX distribution; they were subset to Latin and converted to WOFF2 (about 28 KB per face), and renamed with an `ourjob-lmsubset-` prefix as the license requests for derived works. License and manifest are in `src/fonts/latin-modern/`. Source Serif 4 was not needed.

### CV preview matches what pdflatex actually renders
`templates/resume-sample.tex` was compiled with pdflatex (MiKTeX, 1 page). The template uses OT1 Computer Modern (no `fontenc`), which has no bold small caps, so LaTeX substitutes bold upright for `\scshape\bfseries` section titles (log: "Font shape OT1/cmr/bx/sc undefined, using OT1/cmr/bx/n"). The HTML preview copies the real output (bold upright section titles, small caps only for the name), not the macro's intent. Dimensions come from the template: letter paper, 0.3in and 0.4in margins, 10pt base, `\small` 9pt, `\large` 12pt, `\huge` 20.74pt.

The font encoding question is settled below ("Font encoding: keep the template exactly as it is").

### Auth: JWT sessions, no adapter tables
Auth.js uses JWT sessions, so the proxy can check sessions without a database call and the schema stays as ARCHITECTURE.md lists it (no accounts, sessions or verification token tables). The `users` row is upserted at sign-in. The allowlist is checked three times: in the `signIn` callback (Google email must be verified and listed), in the proxy's `authorized` callback on every request, and in `requireUser()` used by every page and action. Removing an email from `ALLOWED_EMAILS` signs that person out on the next request.

### Data model additions
- `users.display_name`: PRD F8 asks for a greeting name that can differ from the CV name.
- `job_matches.status_changed_at`: the tracker shows "date moved" (DESIGN.md 5.6).
- `companies.created_at` is the "first seen" date JOB_SOURCES section 6 refers to; no separate column.
- `master_profiles` has a partial unique index so only one version per user is current.
- `jobs.company_id` is required: every job's company is upserted by normalized name first.

### Local database
Docker Postgres 17 on port 5433 (`postgres://ourjob:ourjob@localhost:5433/ourjob`) so it does not collide with a system Postgres. Neon supports Postgres 17.

### /design in production
`/design` returns 404 in production builds unless `ENABLE_DESIGN_TILE=1`. E2E sets it to test the page. The proxy does not require sign-in for `/design` because it only shows fictional data.

### E2E without Google
Playwright runs a production build with a test `AUTH_SECRET` and a fictional allowlist, and mints session cookies with Auth.js's own `encode`. That tests the allowlist gate end to end without calling Google. A real Google sign-in still needs to be checked by hand once Sam adds OAuth credentials.

### Name check
No job product called OurJob turned up in a web search or on GitHub. Small near-matches: `JaneWatson06/ourjobapp` ("OurJob.App", a front-end project with no stars) and `oursky/ourjob` (a company careers page). No clash worth renaming for.

### GitHub Actions versions (checked 2026-10-28)
actions/checkout v7, actions/setup-node v7, pnpm/action-setup v6 (supports pnpm 10, reads the version from `packageManager`).

## 2026-10-28: after the Phase 0 review

### Font encoding: keep the template exactly as it is (Sam's decision)
No `fontenc T1` and no `inputenc` line, so the output matches Pratik's current CV. Non-ASCII Latin letters are handled by `escapeLatex()`, which maps them to LaTeX accent and symbol commands. ARCHITECTURE.md section 6 is updated to match.

Checked with pdflatex (MiKTeX) using the template preamble unchanged: José Müller, Peña, François, Ørsted, Straße, Škoda, Łódź and Jiří compile with no errors and no missing characters, written either as accent commands or as raw UTF-8. Trade-off, measured with pdftotext: OT1 builds an accented letter from two glyphs, so extracted text splits it ("José" becomes "Jos´e"). ASCII text extracts cleanly. If this ever matters for an ATS, the fix that keeps the look is `accsupp` ActualText around each accented letter; that adds a package to the preamble, so it needs Sam's approval first.

### Style tile approval: not given yet
The review line in Sam's message was the unfilled template ("[approved / approved with these changes: ...]"). UI work stays paused; non-UI Phase 1 work continues. Superseded: the palette was then rejected and redesigned (2026-10-29, below).

### Style tile shows the signed-in person's name
Sam asked for the sample to say Pratik instead of the fictional sample name. The style tile now takes the name from the signed-in session and falls back to the fictional sample when nobody is signed in. Pratik's name is not written into the sample CV, `templates/resume-sample.tex` or any fixture: golden rule 5 keeps his data out of the repo, and a committed CV under his name with invented employers would be published with the open-source code. The real app shows his name from his own profile once he imports his CV (Phase 1).

## 2026-10-29: Phase 1, ingestion

### PDF text: unpdf (not pdf-parse)
Compared unpdf 1.9.1 and pdf-parse 2.4.5 on three PDFs: the fictional LaTeX CV (`tests/fixtures/cvs/mei-lin-tan.pdf`), the fictional LinkedIn-style export, and the compiled `templates/resume-sample.tex`. Both gave the same text in the same reading order. unpdf was faster on a cold start (134 ms vs 666 ms), needs no worker setup on serverless, and pdf-parse could not run in the same process as unpdf (their bundled pdf.js versions, 5.4 and 6.4, clash on the global worker). pdf-parse was removed.

### DOCX: mammoth's HTML, not its raw text
`extractRawText` drops headings, list markers and bold. The importer converts DOCX to HTML with `externalFileAccess: false` (untrusted files must not pull in other files), then to Markdown-like text (`#` headings, `-` items, `**bold**`), so P1 can keep bold phrases and section structure.

### Line-end hyphens
PDF exports hyphenate across lines ("Ter-\nraform"). A hyphen at a line end is joined only when the joined word appears elsewhere in the same document; otherwise the hyphen is kept ("Asso-ciate"). Real hyphens such as "Full-Stack" are never touched.

### .tex importer and the shared accent table
`src/lib/ingest/tex.ts` parses CVs in the template's macros (header, sections, subheadings, project headings, bullets with bold spans, Tech lines, links) and returns null for other LaTeX, so the caller falls back to plain text. Accent and symbol commands live in one table (`src/lib/latex/accents.ts`); the importer decodes them and `escapeLatex()` (Phase 2) will encode with the same table. A round-trip test covers both directions. `---` imports as an en dash because em dashes are not allowed in generated text.

### Fixtures
All fictional: Nadia Chowdhury (Markdown CV plus a LinkedIn-style PDF with a deliberate end-date conflict and an extra skill), Tomás Herrera Núñez (DOCX generated from Markdown with pandoc; accents, `&`, hedged metrics), Mei Lin Tan (PDF compiled from LaTeX in the template layout; `&`, `%`, `#`), and an image-only PDF of Mei Lin's CV for the "no selectable text" path. Sources for the generated files are in `tests/fixtures/**/sources/`.

### HTTP: two clients
- `politeFetch` (`src/lib/http/polite.ts`) is for fixed hosts we call (GitHub API, later ATS boards and job boards): User-Agent `OurJob/<version> (+https://github.com/SamisDone/OurJob)`, one request per second per host by default with per-host overrides (Workable will get 3 s), 3 retries with exponential backoff and jitter on 429 and 5xx that honor `Retry-After` (capped at 60 s), and a per-client cache so a URL is fetched once per run.
- `safeFetch` (`src/lib/http/ssrf.ts`) is for URLs a person types in. Only http(s), standard ports (80, 443, 8080, 8443), no credentials in the URL, max 3 redirects (each hop re-checked), 2 MB, 10 s. Every resolved address must be public unicast (ipaddr.js `range() === "unicast"`, IPv4-mapped IPv6 unwrapped). The check runs inside the socket's own DNS `lookup`, so a hostname cannot pass a pre-check and then connect to a private address (DNS rebinding). It uses `node:http(s)` rather than global fetch because fetch does not expose a per-request lookup hook without adding undici as a dependency.

### GitHub import (verified against the live API, 2026-10-29)
`GET /versions` lists `2026-03-10` and `2022-11-28`; requests send `X-GitHub-Api-Version: 2026-03-10`. Real unauthenticated responses for `octocat` (GitHub's demo account, not a real person) are saved in `tests/fixtures/sources/github/octocat/`: user, repos, languages per repo, READMEs fetched with `Accept: application/vnd.github.raw+json`, and the 404 body for repos without a README. All expected fields were present under the new version. Rules: owned non-fork repos only, newest push first, top 20; READMEs for 8 repos (4 by stars, then most recently pushed), first 4,000 characters. Pinned repos need the GraphQL API with a token, so they are not used. `GITHUB_TOKEN` is optional; without it GitHub allows 60 requests an hour, enough for about two imports.

### Portfolio import
Readability on linkedom, links read before Readability mutates the page. Under 300 visible characters means the site likely renders in the browser; the result is flagged `thin` so onboarding can offer a paste box.

## 2026-10-29: redesign to "index card and ballpoint"

### Why
Sam and Pratik rejected the Phase 0 palette (paper grey, yellow highlighter, magenta proofmark) as reading like generic AI design. The new direction from Sam: an index card on a desk, written in blue ballpoint. Matched keywords are circled in blue pen, missing keywords underlined in red pen, rows separated by faint blue ruled lines, cards and panels with a thin red rule at the top, and a red rubber stamp for Applied. Dark mode is "carbon paper". IBM Plex Sans, the type scale, spacing, radii and the rest of DESIGN.md stay. DESIGN.md sections 1, 3, 5.3, 5.4, 5.6, 6, 8 (focus ring), 10.1 (the gradient ban gains one exception, the ruled lines) and 10.2 were rewritten to match.

### Tokens
The highlighter (`--highlight`, `--highlight-ink`) and proofmark (`--proofmark`, `--proofmark-wash`) tokens are gone; a test checks they do not come back. New: `--body`, `--red-rule`, `--redpen`, `--redpen-wash`, `--circle-fill`, `--circle-stroke`. All values are Sam's, with one change: light `--control-edge` is `#6F7EA5`, not `#7685AE`. The brief's value measured 2.88:1 against `--paper`, below the 3:1 WCAG 1.4.11 asks for the edge of a text field; `#6F7EA5` measures 3.18:1 and looks the same.

### Text color rules
`--ink` only for headings, titles, the fit score, primary buttons, links, active nav and the pen marks; `--body` for all running text; `--graphite` for secondary lines. The page default text color is now `--body` and `h1` to `h4` default to `--ink`. Every component was audited: paragraphs, reasons, descriptions, dialog bodies, field text and labels, secondary and ghost buttons, table cells, code view and command palette items moved from `--ink` to `--body`; company lines moved to `--graphite`. Dark `--graphite` on `--circle-fill` is 4.47:1, so circled words always use `--body` and graphite never sits on the fill.

### Contrast (WCAG 2.2 AA), enforced by tests/unit/design/tokens.test.ts

| Pair | Use, minimum | Light | Dark |
|---|---|---|---|
| --ink on --paper | text, 4.5 | 7.93 | 14.09 |
| --ink on --sheet | text, 4.5 | 10.07 | 12.64 |
| --body on --paper | text, 4.5 | 10.18 | 11.61 |
| --body on --sheet | text, 4.5 | 12.93 | 10.41 |
| --graphite on --paper | text, 4.5 | 5.15 | 7.37 |
| --graphite on --sheet | text, 4.5 | 6.54 | 6.61 |
| --redpen on --paper | text, 4.5 | 4.60 | 6.53 |
| --redpen on --sheet | text, 4.5 | 5.84 | 5.85 |
| --ok on --paper | text, 4.5 | 5.20 | 8.30 |
| --ok on --sheet | text, 4.5 | 6.61 | 7.45 |
| --caution on --paper | text, 4.5 | 5.07 | 8.74 |
| --caution on --sheet | text, 4.5 | 6.45 | 7.84 |
| --body on --circle-fill | circled word, 4.5 | 10.31 | 7.04 |
| --ink on --circle-fill | ink on circle fill, 4.5 | 8.03 | 8.55 |
| --sheet on --ink | primary button, 4.5 | 10.07 | 12.64 |
| --sheet on --redpen | destructive button, 4.5 | 5.84 | 5.85 |
| --circle-stroke on --sheet | pen circle, 3 | 10.07 | 7.53 |
| --circle-stroke on --circle-fill | pen circle on its fill, 3 | 8.03 | 5.09 |
| --redpen on --sheet | red underline, 3 | 5.84 | 5.85 |
| --control-edge on --paper | field edge, 3 | 3.18 | 4.12 |
| --control-edge on --sheet | field edge, 3 | 4.04 | 3.70 |

`--red-rule` is decoration only and never carries text, so it has no text requirement.

### How the pen marks are built
- `PenCircle` and `PenUnderline` (`src/components/marks/pen.tsx`) draw SVG paths seeded by the word and its position, so each mark is slightly different and the same word always gets the same mark. The circle is an open loop of about 1.1 turns that ends a little outside its start, like a quick pen loop, with a calmer closed shape for the fill. `vector-effect: non-scaling-stroke` keeps the 1.5 px (circle) and 2 px (underline) strokes even however wide the word is.
- An ellipse needs about 1.4 times the box of the word it encloses, so circles get 0.42 em of side padding. Marks are sized to the letters (line-height 1.2 inside the mark), not the line box, so they never reach into the line above or below.
- Marked job descriptions use a 28 px line height instead of the scale's 24 px. At 24 px a circle on one line touched a red underline on the line above in testing. This is the only line-height exception and it is written into DESIGN.md section 3.
- The drawing moment uses `pathLength=1` and a stroke-dashoffset transition: circles in reading order with a 30 ms stagger (shrinking if there are many matches) and a 240 ms draw, then underlines; the whole moment stays under 1.2 s (`penTiming`, tested). Reduced motion makes every transition instant through the global rule in globals.css.

### Index card details
- Ruled lines are a `ruled` utility (hairlines every 32 px from a repeating linear gradient). DESIGN.md 10.1 bans gradients as decoration; this is recorded there as the one exception, and it is used only on the Today feed and in empty states. In empty states the text is set at 32 px so it sits on the lines.
- The red rule is a `red-rule-top` utility (a 2 px line, clipped by the panel's rounded corners). It is on the Today panels, dialogs, sheets, tracker cards, empty states, error states and the new `Panel` primitive. The utility does not set `position`, because dialogs and sheets are `fixed`; non-positioned users add `relative`.
- With the highlighter gone, the "new since your last visit" marker is a small `--ink` dot in the row margin, like a pen tick.
- The Applied stamp is sentence case ("Applied"), not capitals, because DESIGN.md bans all-caps labels. It sits rotated 4 degrees in the card's top-right corner.
- Focus ring: 2 px `--ink` outline plus a 3 px `--circle-fill` halo (box-shadow spread 5 px outside the 2 px outline).

### Still waiting
Style tile approval for this direction. Real screens stay paused until Sam approves.

## 2026-10-29: TanStack Query for client data (Sam's request)

### Version and guide checked
`@tanstack/react-query` 5.105.0 (published 2026-10-26; peers React 18 or 19). Setup follows the v5 "Advanced Server Rendering" guide for the App Router, checked against the installed type definitions:
- In 5.105 the server check is `environmentManager.isServer()`, a function. Older v5 releases exported `isServer` as a boolean constant; code written from memory would treat the function as always truthy and share one client across requests.
- `dehydrate.shouldRedactErrors` and `defaultShouldDehydrateQuery` exist as the guide describes; pending queries are dehydrated so prefetches can stream.
- The browser client is a module singleton, not `useState`, because the guide warns React can discard state from a render that suspends with no boundary above the provider.

### Choices
- Defaults: `staleTime` 60 s (so hydrated data is not refetched at once), query retry 1, mutation retry 0 (a mutation changes his data and must never repeat silently).
- The tailor workspace turns off refetch on window focus through a shared options object rather than a global default, because the feed and pipeline status should refresh when he comes back to the tab.
- Optimistic updates are built in a plain function (`createOptimisticHandlers`) so they can be tested against a real `QueryClient` without React; the hook only wires them into `useMutation` and adds the toast with Undo.
- Feed filters are normalized before they go into the key, so `{ seniority: ["senior", "mid"] }` and `{ seniority: ["mid", "senior"], sort: "fit" }` share one cache entry.
- Query functions call route handlers, never server actions (server actions run one at a time from the client).

### What is wired now and what waits
Done: the client factory, the provider in the app shell, the server prefetch and hydration helper, every query and mutation key, the optimistic mutation hook with rollback and Undo, and the tailoring progress hook. The per-screen query and mutation hooks (feed, tracker, companies, profile edits, tailoring history) are written with those screens, which stay paused until the new style tile is approved. Each screen uses these helpers rather than calling `useQuery` or `useMutation` directly.

## 2026-10-29: style tile approved; sign out

### Style tile approved
Pratik approved the "index card and ballpoint" style tile. Sam accepted all six departures listed in the review: light `--control-edge` #6F7EA5, 28 px line height for marked job descriptions, sentence-case "Applied" stamp, the ink dot as the new marker, the red rule on dialogs, sheets and error panels, and the edits to DESIGN.md sections 8 and 10.1. Real screens can now be built.

### Sign-in checked
A real Google sign-in by an allowed account created a `users` row on 2026-10-28 (15:37 UTC). Earlier, a headless run confirmed Google accepts the OAuth client and the `http://localhost:3000/api/auth/callback/google` redirect URI.

### Sign out (Sam's request)
- One server action, `signOutAction`, calls Auth.js `signOut({ redirectTo: "/sign-in?signedOut=1" })`. The client hook `useSignOut` clears the TanStack Query cache first, so no data from the session stays in memory, then calls the action inside a transition.
- Entry points: the account item at the bottom of the rail (avatar and display name; a menu with the signed-in email, Settings and Sign out), the bottom of the mobile More sheet, Settings > Account, and the command palette. No confirmation dialog.
- Styled as a secondary action (never red: it is not destructive). The sign-in page shows "Signed out." as a quiet `role="status"` line in `--graphite`.
- The Google avatar is a plain `<img>` with `referrerPolicy="no-referrer"` rather than next/image, to avoid adding googleusercontent.com to remote image patterns for one 24 px picture. Without a photo, the initial sits on `--circle-fill`.
- Playwright: signs out from the rail menu (desktop) and the More sheet (phone), checks the session cookie is gone and `/today`, `/profile`, `/settings` redirect to `/sign-in`; a second test signs out from the command palette.
- DESIGN.md sections 4, 5.9 and 6 and PRD F8 updated.

## 2026-10-29: Phase 1, LLM layer and profile extraction

### Model: gemini-3.8-flash, fallback gemini-3.5-flash-lite (Sam's choice)
Google's pricing page (checked 2026-10-29) lists Free Tier input and output for gemini-3.8-flash (the newest Flash), gemini-3.6-flash, gemini-3.5-flash-lite and the 2.5 models; Gemini 4 Argon has no free tier. The rate-limits page does not publish free-tier numbers ("can be viewed in Google AI Studio"), so `LLM_RPM` (default 8) is a conservative token bucket; raise it to match what AI Studio shows. Sam asked for gemini-3.8-flash with the lite model as fallback: after 3 retries on 503 or 429, the provider tries `LLM_FALLBACK_MODEL` (default gemini-3.5-flash-lite) and logs which model answered. Free-tier content may be used by Google to improve its products; Settings says so.

### Verified against reality
- The first key in `.env.local` was rejected by every endpoint (401 `ACCESS_TOKEN_TYPE_UNSUPPORTED`, including the model-independent list call), so it was not a valid Gemini API key. The replacement key works.
- `pnpm llm:smoke` made a real structured-output call. gemini-3.5-flash-lite answered in 2.4 s. gemini-3.8-flash answered 503 "high demand" for several minutes, then answered correctly; that response is saved as `tests/fixtures/llm/gemini/structured-response.json` (headers removed). It shows the model thinks (303 `thoughtsTokenCount`), so output usage counts thinking tokens.
- The SDK (@google/genai 2.31) retries 408, 429 and 5xx up to 5 times with delays of up to 60 s by default (`HttpRetryOptions`), which made one call take 379 s. The provider sets `retryOptions: { attempts: 1 }` and a 90 s request timeout, so its own bounded retries and the fallback decide.
- Structured output: `responseMimeType: "application/json"` plus `responseJsonSchema`, which accepts a listed subset of JSON Schema. Zod 4's `toJSONSchema` (input shape, so defaulted fields are optional for the model) is filtered to that subset; Zod still validates the full answer, with one retry that includes the validation errors.

### Mock provider fixtures: exact hash, then match strings
ARCHITECTURE.md said the mock reads `tests/fixtures/llm/<promptId>/<hash>.json`. Hash-only fixtures break on every prompt wording change. The mock now checks the exact hash first (what `createRecordingProvider` writes during evals), then falls back to fixtures with `match` strings that must all appear in the prompt (for example the fictional person's name). ARCHITECTURE.md section 9 updated.

### P1 leaves ids and evidence to code
The model returns the profile without ids or skill evidence. `normalizeProfile` assigns ids (exp_1, b_1_2, proj_1, b_p1_1, edu_1, sk_go, ...), normalizes dates, maps skills to canonical names from `data/skill-synonyms.json` and merges duplicates, computes evidence by matching skill names and aliases in bullet text and tech lines (word boundaries: "Java" never matches "JavaScript"), keeps metrics and bold phrases only when they are literally in the bullet, keeps a hedge only when its word is in the text, and points conflicts at the item id (`experience.exp_2.end`). The model cannot create references to things that do not exist.

### How "complete profile" is checked
Each fictional fixture CV has hand-written expected facts in `tests/fixtures/expected/` (roles with titles and dates, bullet counts, projects, education, skills by canonical name, certifications, metrics, hedges, conflicts), written from the source document, not from the mock answer. `compareProfile` reports what is missing. Unit tests run each fixture file through extraction, the P1 prompt, the mock and normalization; `pnpm eval:prompts` runs the same comparison with the real model.

## 2026-10-29: Phase 1, screens and data

### Profile storage
- Every save is a new `master_profiles` row; nothing is overwritten. Restoring copies an old version forward as the newest one, so history only grows. A partial unique index keeps one current version per user.
- New nullable column `master_profiles.note` (migration 0001) holds what changed ("Resolved end for Taka Pay; Edited a bullet in Parcelwise"), for the history sheet DESIGN.md 5.8 describes. Additive; drops nothing.
- Edits are typed operations (`src/lib/profile/edit.ts`), validated with Zod at the API. The server applies them to the current version and saves the result; the browser runs the same function for an optimistic update and rolls back if the server refuses. Ids and sources cannot be edited. Items and bullets he adds get ids with a random suffix (`exp_u3k9x2`) and the `user_added` source, so ids are never reused.
- Conflicts are never picked silently: the profile cannot be confirmed while any remain (API returns 409, the button is disabled with the reason next to it).
- Only the newest source of each kind feeds P1; a CV upload in any format replaces the previous CV. Older uploads stay in `profile_sources` for re-import diffs later.
- The store is tested on PGlite (Postgres compiled to WebAssembly) with the real migrations, so tests need no database server.

### API shape
Route handlers under `/api/sources`, `/api/profile`, `/api/profile/versions` and `/api/preferences`, each re-checking the session (`withUser`) and returning errors as JSON with copy that can be shown as is. `/api/profile/build` is limited to 10 runs an hour per user to protect the free LLM quota. Uploads are checked for size (5 MB), extension and magic bytes.

### Screens
- Onboarding steps 1 to 4 as DESIGN.md 5.2 describes, with the step in the URL (`?step=`) so back and forward work. Step 5 (live first search) needs the job pipeline (Phase 3/5); until then the last screen says the daily search is not switched on yet, rather than pretending.
- /today sends anyone without a confirmed profile to onboarding, so a first sign-in lands in the right place.
- The profile editor is a document on an index card: header like the top of a CV, sections with headings, items with source badges, inline editing on click, bullets reordered by drag or with Move up / Move down buttons (the keyboard path), item edit forms, removal with an Undo toast (Undo restores the previous version), skills grouped by category with a dashed border for skills no bullet mentions, and version history in a side sheet.
- A bullet shows its own source badges only when they differ from its item's; repeating "CV, LinkedIn" under every line was noise.
- Search preferences are one form used in onboarding step 4 and in Settings. Country names come from `Intl.DisplayNames`; "My region" maps to the continent plus APAC or EMEA (`src/lib/geo.ts`).
- On phones the onboarding progress is one line ("Step 4 of 5: What you want") instead of a wrapping list.
- `(app)/loading.tsx` gives every app page a designed loading state. It also limits Next's link prefetching to that boundary, so the rail no longer renders six full pages on every page view.

### Sign out: what changed while testing it
Stress-testing the sign-out e2e test exposed two real problems:
1. **Sign-out could be undone.** Auth.js's proxy wrapper re-issues the session cookie on every request it passes. A link prefetch that finished just after sign-out set the cookie again and signed him back in. The proxy (`src/proxy.ts`) now only decodes the token with `getToken` and checks the allowlist; it never sets a cookie. Consequence: sessions last a fixed 30 days from sign-in instead of extending with use. Route handlers still go through Auth.js. Also, a JWT session cannot be revoked server-side; a copied cookie would stay valid until it expires. Acceptable for a single-owner deployment; a per-user "signed out at" check could close it later.
2. **Sign-out could hang for seconds.** A server action also re-renders the page being left; on a busy server that took over 5 s. Sign-out now aborts in-flight queries (their fetches pass the abort signal), waits up to 5 s for running mutations, clears the query cache, calls Auth.js's own sign-out endpoint (`next-auth/react` `signOut`, with its CSRF token), and then does a full page load to `/sign-in?signedOut=1`, which also wipes everything in browser memory.
The test now passes 20 out of 20 repeated runs on a loaded machine.

### Tooling
- `tests/fixtures/` is excluded from Prettier: fixtures must stay byte-for-byte as committed (a formatting pass changed the fictional CVs and broke a test).
- `pnpm llm:smoke` makes one real structured-output call; `pnpm eval:prompts` runs P1 and P5 on the fictional fixtures with the real model and grades them against the expected facts (`--record` saves answers as mock fixtures).
- `tests/e2e/shots.spec.ts` takes review screenshots of the Phase 1 screens when `SHOTS_DIR` is set; it seeds the fictional profile through the real API.

## 2026-10-29: Phase 1 done criteria, real-model results

- `pnpm eval:prompts` with the real model on the three fictional fixtures: all expected facts present for each (roles, titles, dates, bullet counts, projects, education, skills, certifications, numbers, hedges, and Nadia's CV/LinkedIn end-date conflict, which the model found itself). `gemini-3.8-flash` answered P1 in about 43 s when not busy; it often answered 503, and the fallback `gemini-3.5-flash-lite` answered in 3 to 30 s.
- The eval at first reported "missing" metrics that were in the bullet text, because the model split them differently ("80 ms" instead of "p99 under 80 ms"). The expected-facts check now asks whether the number survives in a bullet's text (what the Phase 2 validator checks); hedges are still checked on metrics.
- The lite model once left out the email shown in the CV header. `buildProfile` now copies the first email address from the CV text when the model returns none: a copied fact, never an invented one.
- Onboarding end to end with the real provider: `E2E_LLM_PROVIDER=gemini pnpm exec playwright test tests/e2e/onboarding.spec.ts --project=desktop` passed in 1.5 minutes (real P1 build, the model's own conflict, edits, confirm, real P5 suggestions, version history and restore), using the fictional Nadia Chowdhury files and the e2e test user.
- Build hygiene: the mock provider reads fixtures from dynamic paths, which made Next's output tracing include the whole project (fixtures included) in every server function. `outputFileTracingExcludes` now drops tests, docs, templates, migrations, scripts and workflows from deployments, and the warning is silenced for `mock.ts` only.

## 2026-10-29: Onboarding and style tile review (22 items)

Checked with screenshots at 1440, 1100 and 390 px in light and dark (`tests/e2e/shots.spec.ts`). The measurable items are now tests: `tests/e2e/design.spec.ts` (circle spacing, smallest CV text, desk columns and overflow, phone panes, 44 px tap targets), `tests/unit/ats/display.test.ts` and `tests/unit/salary/input.test.ts`.

### Tailoring desk layout (items 10, 13, 14)
- The CV preview never draws narrower than 612 px, so 9 pt text is at least 9 px on screen (1 pt = sheet width / 612). True size is 816 px. Below 612 px of column the page scrolls sideways inside its pane, with a note, instead of shrinking the text.
- Three columns need 260 + 612 + 260 px plus two 24 px gaps: 1,180 px of workspace. The desk uses container queries (`@container`) on its own width, not media queries on the window, because the rail's width changes the space. Thresholds: 1,180 px for three columns, 916 px for two (280 + 612 + gap).
- At 1440 px with the full 220 px rail the workspace is about 1,188 px, just enough. Between 1024 and 1439 px the rail switches to icons on `/tailor` (and on `/design`, which shows the desk) so a 1,100 px window gets a comfortable two-column layout and three columns start at a window of about 1,310 px (64 px rail, 32 px page padding each side) instead of 1,470 px. Other pages keep the labeled rail.
- In two columns the score is a sticky panel above both columns with a one-line summary, the actions and "Show details"; in three columns it is the sticky right column. On phones: Job / CV / Score segmented control, and the actions pinned above the tab bar only while the desk is on screen (an IntersectionObserver), so the bar never covers other sections. The pinned bar uses icon buttons for Copy LaTeX and Download so they fit at 390 px.

### CV preview vs. the PDF (item 11)
The review asked for small-caps section headings. The template is kept exactly (no `fontenc` T1, decided earlier), and in OT1 Computer Modern there is no bold small caps: the pdflatex log for the template says `Font shape OT1/cmr/bx/sc undefined, using OT1/cmr/bx/n`. The real PDF therefore shows section headings in bold upright, and the name (not bold) in small caps. The preview copies the real PDF, so headings stay bold upright and the name stays in small caps. What was wrong was color: the app's global heading color leaked into the sheet and made headings blue. `cv-sheet.css` now forces every element inside the sheet to inherit black. If Pratik wants small-caps headings in the PDF too, that is a template change (T1 encoding or a different font), not a preview change.

### Pen circles (item 12)
Circles have 0.45 em of padding inside and 0.15 em of margin outside, and the ellipse is drawn inside the padded box (x radius 45.5% with drift, fill 44%), so a stroke never reaches the next word or punctuation. A test measures at least 2 px between each circle and the characters beside it on the same line.

### Score points (item 15)
Component points are shown as whole numbers using largest-remainder rounding (`wholePoints` in `src/lib/ats/display.ts`), so the parts always add up to the rounded total shown in the big number. The engine keeps its unrounded values.

### Salary input (item 21)
`parseAmountInput` accepts 40k, 40,000, 40000, $40k, USD 40,000, 40.5k, "40 000" and "120k a year". A bare decimal without k ("40.5") is rejected as ambiguous. The field keeps what was typed while editing, shows "Enter an amount like 40k, 40,000 or 40000." when it cannot read it, formats on blur, and Save is disabled while it is invalid.

### Cards, rules and text (items 2, 7, 16, 17)
- The red rule on cards is now the card's own 2 px top border instead of a pseudo-element inside an `overflow: hidden` box. The clipped version cut off pen marks and the last paragraph of the long job post.
- Ruled lines are drawn every 32 px with text at a 32 px line height, so text sits on the lines; the line is 5 px under the baseline so descenders clear it. Buttons sit below the ruled area, never on it.
- `text-wrap: balance` for headings and `text-wrap: pretty` for paragraphs, list items and labels, app-wide.

### Onboarding (items 1, 3 to 6, 8, 9)
- Header with the account menu (avatar, email, Settings, Sign out), so sign-out is reachable before the app shell exists for him.
- The upload card has one line of text (file types once, and "Only you can see it."); the page heading says what to do. The Overleaf hint and "Paste your CV as text instead" sit under the card. Pasted text is stored as a `cv_md` source named "Pasted text", so it goes through the same build path as a Markdown upload.
- Content at a 640 px reading width inside an 800 px column, about 12% down the window on wide screens.
- Done steps in the stepper are buttons that go back; future steps are plain text. Back buttons from step 2 on.

### Tracker and controls (items 18 to 20)
- The board scrolls sideways from 768 px with 272 px columns, snap points and a note when it overflows; on phones the columns stack. Card actions ("Tailored CV", "Move to") have their own row and never wrap.
- The stepper and segmented controls are `white-space: nowrap`; at 1100 px they fit on one line.
- Interactive controls are at least 44 px tall below 768 px (buttons, chips, segmented options, chip remove buttons, link buttons, palette items; the switch gets a 44 px invisible hit area).

## 2026-10-29: One app shell for every signed-in page

**Why Today showed no sidebar.** `/today` redirected to `/onboarding` when the profile was not confirmed, and `/onboarding` lived outside the `(app)` route group with its own bare layout (a wordmark header). So clicking Today swapped the whole layout: the rail and bottom bar disappeared and the shell re-mounted on the way back.

What changed:
- Onboarding moved into `(app)`. Every signed-in route now shares one layout: `/today`, `/tailor`, `/tailor/[id]`, `/jobs/[id]`, `/tracker`, `/companies`, `/profile`, `/settings`, `/onboarding` and the signed-in 404. Only `/sign-in` and the dev-only `/design` have no shell.
- No redirects to onboarding. Today, Tailor, Tracker and Companies (and the two detail pages) render "Finish your profile first." with one sentence on why and "Continue onboarding" (to step 3 when a draft profile exists). Screens not built yet render "Coming soon in this build." `/tailor/[id]` and `/jobs/[id]` exist now as such pages.
- Active item on every route: `/jobs/*` lights up Today, `/tailor/*` Tailor, onboarding Profile (it builds the profile). On phones More is the active item for Companies, Profile and Settings, and the More sheet marks the current page.
- The rail's collapsed state moved from localStorage to a cookie read by the layout. With localStorage the server always rendered the wide rail and the client narrowed it after hydration, a visible jump on every full page load. A JavaScript-off test checks the server's HTML is already collapsed.
- Signed-in 404: `(app)/[...missing]` calls `notFound()`, rendered by `(app)/not-found.tsx` inside the shell. The pages moved into a nested `(app)/(screens)` group that owns `loading.tsx`, because a loading boundary starts streaming with status 200 before the page runs and the 404 then went out as a 200. The root `not-found.tsx` stays for signed-out visitors.
- The account menu's "header" variant (only onboarding used it) is gone.
- Kept on purpose: the rail still switches to icons on `/tailor` between 1024 and 1439 px (decided in the review above, so the desk gets its columns). It is the one place the shell changes width between pages, with the existing 200 ms width transition.
- Tests: `tests/e2e/shell.spec.ts` visits every route above for a person with no profile and one with a confirmed profile, at 1440 px (rail, account menu, active item) and 390 px (bottom bar, More, the More sheet), plus the 404 status, no re-mount while navigating, and the collapsed rail from first paint. Two fictional e2e people (`fresh@example.com`, `confirmed@example.com`) keep it from racing the onboarding test; global setup seeds the confirmed one with the fictional Nadia profile.

### A real race this exposed
With more tests running in parallel, the onboarding test sometimes ended with an unconfirmed profile. Cause: `saveProfileVersion` read the current version's `confirmedAt` and the latest version number without a lock. A bullet edit still saving while he pressed Confirm wrote a new current version carrying the old "not confirmed" state, silently undoing the confirmation; two edits at once also picked the same version number and one failed. Profile writes (`saveProfileVersion`, `confirmProfile`) now take a row lock on the person's `users` row inside their transaction, so they run one at a time. Three full e2e runs in a row: 30 of 30 passed each time.

## 2026-10-29: Nadia is the one sample person

Sam asked for one fictional person everywhere. The style tile sample, `templates/resume-sample.tex` and the tests that read them now use Nadia Chowdhury, built only from the facts in her fixture CV (`tests/fixtures/cvs/nadia-chowdhury.md`): a tailored one-page version for a fictional Senior Backend Engineer post at Lumen Labs. That makes the template a golden target for Phase 2: rendering her profile tailored to that job should give this structure. The template loses two shapes the old sample showed (an employer linked to its website, a project with a Live link), because her profile has neither; comments in the template show both forms, and a unit test still parses a linked employer. No code, template, fixture, test or doc mentions the old sample person any more.

## 2026-10-29: Deployment to Vercel Hobby and Neon (Singapore)

Checked against current docs: Vercel's region list (`sin1` is Singapore, ap-southeast-1; Hobby allows one function region, set with `regions` in `vercel.json`), Auth.js v5's deployment guide (`AUTH_URL` is unnecessary when the host comes from request headers; trust host is inferred on Vercel; `AUTH_SECRET` is the only strictly required variable; the Next.js callback is `/api/auth/callback/google`), and Neon's guidance (pooled `-pooler` URL for the app, direct URL for migrations). Neon's docs site refused connections during this check, so the pooled/direct split comes from Neon's FAQ pages.
- `vercel.json` sets `regions: ["sin1"]`, next to a Neon project in AWS Singapore.
- `pnpm db:migrate:prod` reads only `.env.production.local`, prefers `DATABASE_URL_UNPOOLED` (Neon's direct connection), refuses a local host and warns on a pooled host. It never reads `.env.local`, so it cannot migrate the wrong database. Migrations run by hand before a deploy that needs them, not in Vercel's build: a build should not change a database, and a failed migration should stop before code that depends on it ships.
- The app connects through the pooled URL with `prepare: false` (already the case). The profile row lock is transaction-scoped, so it works through Neon's transaction pooler; a session-level advisory lock would not have.
- The proxy now also reads `x-forwarded-proto` to choose the secure session cookie name, matching what Auth.js does behind a TLS proxy, so a protocol mismatch cannot turn into a sign-in loop. `auth.ts` already had `trustHost: true`.
- `/design` stays a 404 in production unless `ENABLE_DESIGN_TILE=1` (checked on a local production build: 404).
- `APP_URL` was listed in `.env.example` but nothing reads it; removed. `DATABASE_URL_UNPOOLED` added.
- Env vars for Production only, so preview deployments never touch the production database. Google sign-in only works on the production address anyway.

## 2026-10-29: Lite is the default model; Flash is the optional Thorough model

Sam's rule: if the lite model passes the validator as well as the bigger one, make it the default and keep the bigger one optional in Settings; target under 45 s from paste to result. `pnpm eval:tailor` ran the whole pipeline (clean, P2, keyword split, P3, validator, fix loop) on the ten fictional posts in `tests/fixtures/jds` against Nadia's fictional profile.
- gemini-3.5-flash-lite: 10 of 10 finished, median 13.0 s, slowest 16.8 s (P2 about 5 s, P3 about 7 s). Every first draft passed the validator with nothing to fix: no unsupported numbers, no gap keywords, no em dashes, every matched keyword used. The prompt injection in post 08 was ignored. The weakness the validator cannot see: lite rewrites little (13 of 45 bullets reworded, 23 of 53 matched keywords inside bullets rather than only in skills).
- gemini-3.8-flash: no result. It answered 503 for the first five posts, then 429. The 429 body says why: the free tier allows 20 requests per day per model for it (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, saved as `tests/fixtures/llm/gemini/daily-quota-429.json`). An hour of retries did not get through.
- Decision: lite is `LLM_MODEL` (used for everything) and Flash is the fallback and the suggested `LLM_THOROUGH_MODEL`. Even if Flash rewrites better, 20 requests a day is about 5 to 10 tailored CVs, so it cannot be the default on the free tier. Lite has passed 30+ calls in a day with no 429, so its daily limit is higher; AI Studio shows the exact number.
- The Thorough model only writes the CV (P3 and fixes). The job post is always read by the standard model: P2 is extraction checked in code by `checkJobSpec`, and this halves Thorough's quota use. The eval does the same and shares one P2 answer per post between models, so they tailor from the same job spec.
- A 429 for a daily quota is no longer retried (retrying cannot help); the provider goes straight to the fallback, and without one it says the limit resets in N hours instead of "wait about a minute".
- The Settings copy no longer claims Thorough "rewords more": that is unmeasured. To measure it once Flash's quota resets: `pnpm eval:tailor --models=gemini-3.8-flash --out=eval-output/run2` (about 10 to 15 Flash calls), then `pnpm exec tsx scripts/eval-tailor-summary.ts eval-output/run2`.

## 2026-10-30: P3 rewords and places keywords; copied job claims are caught in code

Lite copied most source bullets as they were and left matched keywords in the skills list. p3.2 adds, per source bullet, the matched terms that bullet's own text proves (`<placement>`), the terms proven only by a tech line or skills (`<tech_only>`, kept out of bullets: joining a role's tech line to one of its bullets can invent a claim such as "built the rate-quote service in Go"), a "how to write each bullet" section and one fictional example. A first version also told the model to use the job's words; lite then pasted a job responsibility into a bullet ("Ingest data from APIs, SFTP drops and Kafka topics by..."), an invented claim the validator could not see. That instruction is gone, the prompt now forbids it, and validator check 2b (`copiedJobPhrase`) catches a 5-word run shared with the job post that brings in a content word the bullet's sources never use. On all 79 bullets of both runs below it flags only that one.

Measured on the 10 fictional posts with gemini-3.5-flash-lite, P2 included (`pnpm eval:tailor`, summary by `scripts/eval-tailor-summary.ts`):

| | Before (p3.1) | After (p3.2) |
|---|---|---|
| Runs ok | 10/10 | 10/10 |
| Bullets reworded (any change) | 11/47 (23%) | 19/34 (56%) |
| Bullets with 20%+ new words | 2 | 0 |
| Matched keywords in bullets | 24/56 | 20/52 |
| ...of those a source bullet proves (placeable) | 21 (3 came from tech lines) | 20 of 20 |
| Validator first pass clean | 10/10 | 10/10 |
| Gap leaks, unsupported numbers | 0, 0 | 0, 0 |
| Bullets copying the job post | 0 | 0 |
| Median time | 56.3 s | 47.7 s |
| Under 45 s | 3/10 | 2/10 |

- "20%+ new words" stays low by design: the profile allows reordering, trimming and choosing which facts lead, not new vocabulary. Nadia's fixture has five source bullets, so "placeable" is the honest ceiling for keywords in bullets; the rest go to skills and Tech lines, which the ATS score counts as experience.
- After uses fewer bullets (3.4 per CV against 4.7). The "leave a bullet out rather than bend it" rule likely does this; watch it on a richer profile.
- Time: lite answered slowly on 2026-10-29 and 30 (15 to 35 s per call against about 6 s in the first run), so both runs miss the 45 s target mostly on API latency; P2 alone took 15 to 50 s.

## 2026-10-30: Tailoring keeps every role bullet; the fallback model is a hedge after 20 s

Sam: tailoring must not drop real experience. p3.2 (and p3.1 before it) cut role bullets to fit the old "1 or 2 bullets per role" length rule, silently: 19 of 60 role bullets left out across the 10 posts with p3.1, 33 of 60 with p3.2, none with a reason.
- p3.3/p3.4: every role is kept, one tailored bullet per source bullet; one page is reached by shorter bullets and fewer projects. A role bullet may be left out only when it is clearly irrelevant, with a note "Left out <id>: <what it is about> is unrelated to <what the job needs>".
- Validator check 9 (code, not just prompt): a role's source bullet that no tailored bullet uses goes to the fix loop ("Keep b_1_3 from Parcelwise..."), which adds it back, unless a note names its id with a specific reason of 6 words or more ("irrelevant to this job" was the reason p3.3 gave for leaving out the Go rate-quote bullet on a payments job, so generic reasons do not count). Bullets the fix loop removes for accuracy get such a note automatically. `scripts/eval-tailor-summary.ts` prints source against tailored bullets per role and every left-out bullet with its reason.
- 10 posts, lite, p3.4: 60 of 60 role bullets kept, 0 left out, 9 of 10 first pass clean (one fixed in one round), 0 gap leaks, 0 unsupported numbers, 0 copied job claims, matched keywords 53 of 53 used and every placeable one in a bullet, median 9.2 s (lite was fast again; every post under 45 s).
- Speed: when the main model has not answered after `LLM_SLOW_MS` (default 20 s), the fallback is asked as well, the first answer wins and the other request is cancelled (`abortSignal`, client-side; the cancelled call still counts against quota). If the fallback fails, for example Flash's 20-a-day free quota is used up, the main answer is still awaited. Not exercised in the run above: lite answered every call in under 20 s.
- The workspace shows three steps while tailoring runs, from the pipeline's stages: Reading the job, Tailoring your CV, Checking every fact against your profile (redesign branch, where the Tailor screen is wired).

## 2026-10-30: Tailor screen, LaTeX output, ATS score and the one-page check

- **Template fix.** `templates/resume-sample.tex` ended the name line and the skills lines with `\ ` (a control space), which leaves the line open and can merge it with the next one. They now end with `\\`. `renderLatex` keeps `PREAMBLE` identical to the template's preamble, checked by a test.
- **One shared document.** `buildCvDocument(profile, tailored?)` builds one `CvDocument` used by both the HTML preview and the LaTeX renderer, so the preview cannot drift from the `.tex` file.
- **Open in Overleaf**, read on overleaf.com/devs on 2026-10-30 (overleaf.com itself failed DNS here; fr.overleaf.com/devs served the same page): a form POST to `https://www.overleaf.com/docs` with `encoded_snip` (the URL-encoded source) and `engine=pdflatex`. A hidden form in a new tab, so nothing passes through our server. Download uses a Blob; Copy uses the clipboard.
- **ATS score** (`src/lib/ats/score.ts`) follows ATS_SCORING.md section 3: must-have 45, nice-to-have 15 (weight moves to must-have when a job lists none), placement 10, title 10, seniority 5, parseability 15 from 7 checks. The result page shows the master CV score next to the tailored one.
- **Tailoring API.** `POST /api/tailor` streams newline-delimited JSON (`stage`, `done` with the saved id, or `error` with a status) so the screen can show the three steps for real instead of on a timer. `maxDuration = 300`, the Vercel Hobby limit for functions with fluid compute (checked in Vercel's docs). Each run is saved to `tailorings` with the job spec, tailored CV, validator report, LaTeX, both scores, options and the profile version.
- **Page budget calibrated.** `LINES_PER_PAGE` went from 50 to 74 after compiling real CVs with pdflatex (MiKTeX): estimates up to 75.6 lines fitted on one page and 78 spilled. At 50, the estimate wrongly flagged 5 of 6 one-page CVs as too long. `scripts/check-cv-fit.ts` renders every CV of an eval run and counts the PDF pages.
- **One-page check with every role bullet kept** (Sam: never trim role bullets to fit). gemini-3.5-flash-lite, 10 fictional posts each:
  - Nadia (3 roles, 6 role bullets), p3.4: 10 of 10 one page, 60 of 60 role bullets kept.
  - Tomás Varga, a richer fictional profile (`tests/fixtures/profiles/tomas-varga.json`: 4 roles, 16 role bullets, 3 projects). First run, p3.4: 6 of 10 ran (4 failed on Gemini 503s; the eval runs one model with no fallback), all 6 one page, but on the Basketry post the model left out 7 role bullets with formulaic reasons. p3.5 says leaving one out should be rare and gives the reasoning. Second run, p3.5: 10 of 10 ran, **10 of 10 one page, no post overflowed**, 159 of 160 role bullets kept (the one missing, Tidewater b_3_1, was removed for accuracy by the fact check after 2 fix rounds), 9 of 10 first pass clean, 0 gap leaks, 0 unsupported numbers, 62 of 62 matched keywords used, median 12.1 s.
  - Open issue: on the rich profile lite rewords little (16 of 178 bullets changed at all). Not a blocker; worth a prompt pass later.

## 2026-10-29: Redesign with standard shadcn/ui

Sam and Pratik found the "index card and ballpoint" design confusing and cramped, and the fonts and colors wrong. They asked for a clean, familiar app like the official shadcn examples, Linear and Vercel. This replaces the visual direction in DESIGN.md (sections 1, 3, 4, 6, 10 and 11 rewritten); behavior, accessibility, copy rules and states are unchanged. It reverses the Phase 0 entries "shadcn/ui: primitives written by hand" and "Tailwind theme is cleared".
- **Setup, checked against the installed CLI (shadcn 4.23.0).** The CLI's presets are now nova, vega, maia, lyra, mira, luma, sera and rhea; `--defaults` uses nova, so nova is "the current default". `init --preset nova --base radix` (our stack is Radix) wrote `components.json` with style `radix-nova`, base color neutral, CSS variables on, icons Lucide, font Geist. Components are added with `shadcn add`.
- **`cn` package.** The CLI replaced our `cn` helper (clsx + tailwind-merge) with `export { cn } from "cn"`: shadcn's own package (repo shadcn-ui/cn, maintained by shadcn), a drop-in replacement. Kept, since it is the CLI default.
- **Forms.** The registry's `form` item is now empty; the current docs build forms from `Field` with react-hook-form's `Controller` and zod. DESIGN.md says so.
- **TanStack Table is v9.** `useTable` with registered features (`rowSortingFeature`, `createSortedRowModel`), read from the docs shipped in the package. v8's `useReactTable` and `getCoreRowModel` are gone.
- **Status colors.** success, warning, destructive and info, each a text color and a soft background in both themes, with Badge variants and an Alert `warning` variant. All eight pairs pass 4.5:1 on their soft background and on the page and card backgrounds (lowest: success light on its tint, 4.75:1); `tests/unit/design/tokens.test.ts` checks them. The focus ring is info blue. The stock dark sidebar primary (blue) is neutral here, because blue means info.
- **Fonts.** Geist Sans for everything and Geist Mono only for numbers, both through `next/font/google`. A `Nums` component sets just the digits in mono, so "2 days ago" and "$95k to $130k" keep their words in Geist Sans. Latin Modern stays for the CV preview, which must match the PDF.
- **Shell.** The shadcn Sidebar (collapsible to icons, a sheet on phones) replaces the custom rail and the phone bottom bar; its state is shadcn's `sidebar_state` cookie, read on the server. next-themes (`attribute="class"`) replaces our theme script and keeps the `ourjob-theme` storage key, so a saved choice carries over.
- **Lint fix in generated code.** shadcn's `use-mobile` hook sets state inside an effect, which `react-hooks/set-state-in-effect` rejects; it now reads the media query through `useSyncExternalStore`, same behavior.
- **Previews.** Today (Phase 3) and the tailoring screen (Phase 2) have no real data yet, so `/preview/today` and `/preview/tailor` render them with Nadia's fictional data inside the real shell, dev only like `/design`. The real `/today` never shows sample jobs (golden rule 9).
- **Migration in steps.** Old primitives moved to `src/components/legacy/` and old tokens to `src/styles/legacy.css`, so screens not yet migrated still render inside the new shell. Both are deleted once every screen is on shadcn/ui.

## 2026-10-30: Every screen on shadcn/ui; the legacy UI is gone

Settings, Profile, Onboarding, the loading and 404 pages and the `/design` style tile moved to shadcn/ui, so `src/components/legacy/`, `src/styles/legacy.css`, the pen marks and sweep (`src/components/marks`), the old score, desk, job row and kanban components and `@phosphor-icons/react` are deleted. `copy-guard.test.ts` now checks all of `src` for other icon sets and for the old tokens.
- **Forms** use `Field` with react-hook-form 7.91 and `@hookform/resolvers` 6 (zod 4 resolver), as DESIGN.md says. Values are read with `useWatch`, not `form.watch()`: the React Compiler lint rule (`react-hooks/incompatible-library`) skips memoizing any component that calls `watch()`.
- **Shared pieces** in `src/components/forms` (token input, combobox on Popover and Command, drop zone, source badges), `LoadError` (destructive Alert with Try again) and `TaskSteps` (named steps, used by Tailor and onboarding).
- **Settings** is a Card per section; the tailoring model is a RadioGroup of two choice cards. "What kind of remote?" is a RadioGroup (DESIGN.md 5.2). Seniority and employment types stay a multiple ToggleGroup.
- **Onboarding steps**: done steps are links (`?step=n`), as DESIGN.md 5.2 says, where the old indicator used buttons.
- **Profile**: one Card per section. The person's name is an h2 inside the basics card; the page h1 is "Profile".
- **Shell landmarks**: the desktop sidebar now has `role="navigation"` with its "Main" label (the stock Sidebar renders a plain div, so the label named nothing). The phone sheet is titled "Menu" instead of the stock "Sidebar".
- **Touch targets**: one rule in `globals.css` makes default and large primary buttons at least 44 px tall below `md`; token remove buttons are 24 px. Checked by `tests/e2e/design.spec.ts`.
- **Lucide 1.x has no brand icons** (Github, Linkedin are gone). Onboarding uses FileUser for the LinkedIn PDF and FolderGit2 for GitHub.
- **The highlighter sweep is dropped**: the redesign shows matched and missing keywords as soft green and red highlights in the job post. BUILD_PLAN Phase 2 updated.
- **Tailoring e2e** (`tests/e2e/tailor.spec.ts`): the mock model answers P2 and P3 from new fixtures, made from a real gemini-3.5-flash-lite answer for the fictional Lumen Labs post and Nadia (`tests/fixtures/llm/p2-job`, `p3-tailor`; first draft passes the validator, so no fix call). `LLM_MOCK_DELAY_MS` (1500 in e2e) makes each mock call wait, so the three steps are visible on screen; the test also checks the stream reported reading, tailoring and checking.
- **LaTeX escaper**: it held literal en dash, em dash and no-break space characters, which the no-em-dash guard flagged. They are `\u` escapes now; behavior unchanged.
- **Phone overflow fix**: the Tailor result grid (and the tile) had one implicit column sized to the 612 px CV preview, so on a 390 px phone the whole page scrolled sideways by 270 px. The column is now `minmax(0,1fr)`, so only the CV frame scrolls. The tailoring e2e checks the page never scrolls sideways.
- **E2E notes**: while a page streams in, React keeps a hidden copy of it outside `#main`, so the shell test looks for page text inside `#main`. Playwright cannot read a streamed response body in the browser, so the stage order is checked with a direct request to `/api/tailor`.

## 2026-10-30: Fixes from Sam's production test with a real CV

Sam tested production with his real CV and a full-stack post (auth, role-based access control, LLM APIs). Each problem, its cause and the fix. Tests use fictional data only.
- **Onboarding step 4 showed no fields.** `GET /api/preferences` ran P5 before answering when nothing was saved; with Gemini lite taking 15 to 35 s, the form showed only skeletons, and a reload started P5 again (request logs: step 4 at 07:37:17, reload at 07:37:39, left at 07:37:43). Now the GET answers at once with a draft built in code from the profile, and P5 runs from `/api/preferences/suggest` after the form is on screen; its values go into the fields he has not touched (react-hook-form `values` with `keepDirtyValues`). E2E `tests/e2e/preferences.spec.ts` fails if the fields are not visible within 1 s while the mock model takes 1.5 s.
- **Extraction dropped CGPA, Research & Publications and Leadership.** The profile had no place for publications or other sections, and the CV never showed `education.grade`. Added `publications`, `extraSections` and `unplaced`; P1 is p1.2 and says every section lands somewhere. A code check (`checkCoverage`) splits the CV at its headings and keeps any section the profile does not hold as `unplaced`, shown on the profile screen with "Add as a section" and "Set aside"; a CGPA under Education is copied into the entry. The CV renders the grade, publications and other sections. Fixture `tests/fixtures/cvs/farhan-kabir.md` (fictional) with a P1 answer that drops the CGPA and Leadership, as the real run did.
- **Shortened bullets lost the job's words; details were cut; a detail was invented.** The validator checked what a bullet claims against its whole source item, tech line included, and never checked what a rewrite removed. New checks 2c and 2d (`src/lib/tailor/fidelity.ts`): keep every number, named tool, parenthesis, possessive and job word of the source bullet; add no number or tool its own cited bullets do not state. A single-source bullet that fails gets his original wording back in code, so no fix round is spent. Tech lines keep every tool. P3 is p3.6 with the same rules.
- **React and Tailwind under "Backend".** Check 4b moves frontend tools out of a Backend group and backend frameworks out of Frontend.
- **"peers' tasks" lost its apostrophe.** Not LaTeX: escaping and a pdflatex build keep "peers' tasks" (checked). The model dropped it while rewording; check 2c now keeps possessives.
- **Tailored score equal to the master score (83 and 83).** The master score is the whole profile, every bullet and skill, so it already has every keyword the profile proves. Tailoring cannot add skills (golden rule 1), so it can only gain on keywords in bullets and title alignment, and here both were already in place. The score card now says this when the scores tie or the tailored one is lower.
- **About 60 s.** No fix round starts after 30 s (`FIX_BUDGET_MS`), and bullets that break fidelity are restored in code instead of sent back to the model.
- **Re-run on Sam's real profile** (exported read-only to a local scratch folder, never committed) with his production full-stack post. Found a further cause of the dropped "Auth" and the tied score: the job's "authentication", "role-based access control" and "LLM APIs" were classed as gaps although his profile proves them (Firebase Auth, three-role access with per-role routes, the Gemini API), because the synonym map had no such entries. Gaps may never appear in the CV, so the model avoided those words. Added "Authentication" (auth, OAuth, JWT, SSO, ...), "Role-based access control" (RBAC, role-based access, role access, ...) and LLM API names to `data/skill-synonyms.json`. "Firebase Auth" is left out on purpose: as a longer known name it would stop "Firebase" from matching inside "Firebase Auth". REST APIs stays a gap: his profile does not mention REST.
- **Skill groups, more:** programming languages are moved under Languages (4c), and a tech line keeps each tool once (the model returned "PostgreSQL" twice).
- **Time on his profile:** 8.6 to 25.1 s over five local runs (0 fix rounds), against 51.1 s in production, where the job read took 23.2 s and the tailoring call 26.4 s, with no fix rounds. So that run was model latency, which the fix-round budget does not shorten; the hedge (Flash asked too after 20 s) is the limit there.
- **Score varies with the job read:** P2 reads a post a little differently on each uncached run (one run listed authentication and LLM APIs, another did not), so the same post scored 71 to 92 locally. Production caches P2 per post, so one post keeps one reading.
- **E2E timing:** under 4 workers, three tests each failed once in today's runs (sidebar navigation, LinkedIn upload, step 4 fields) and passed on re-run; the step 4 test now holds the suggestion request and checks the preferences response time instead of a 1 s screen timeout.

## 2026-10-30: Each source bullet once; light rewording; stated terms; second lite call at 10 s

- **Duplicate bullet (Sam's production CV).** MediHub had two bullets from the same source bullet and lost its Gemini bullet; the count stayed 2, and check 9 only covered roles, not projects. Check 9 now requires every source bullet of every role and of every project on the CV exactly once: a bullet that only repeats used source bullets is removed, and a missing source bullet is put back in his own words in code (no fix round). P3 says one tailored bullet per source bullet, each used once, and a project on the CV keeps all its bullets.
- **Light rewording (p3.7).** p3.6's keep-every-detail rules made the model return bullets verbatim. Rule D now asks it to lead with what the job cares about and to write a placement term in the job's wording when the bullet proves it; facts and details stay (2c and 2d still check). On Sam's profile, MediHub now reads "Built role-based access control and authentication on Firebase: three-role access (admin, doctor, patient) on Firebase Auth, ..." and "Integrated LLM APIs through the Gemini API ...". Most other bullets still come back unchanged (0 to 2 reworded per run).
- **Stated terms and position-based importance** (`src/lib/jd/terms.ts`). After P2, every dictionary term the post states is a keyword, and must or nice comes from its place in the post. Same post, 5 local runs on Sam's profile: auth, role-based access control, LLM APIs and REST APIs found every time; score 88 to 91 (before: 71 to 92).
- **Backup at 10 s, a second lite call.** `hedgeModel` defaults to the main model; slow answers get a second lite request after `LLM_SLOW_MS` (default now 10 s); Flash is kept only for busy errors. The Thorough tier hedges with lite. In 5 runs on Sam's profile every call answered in under 10 s (12.7 to 15.3 s end to end), so the hedge did not fire; it is covered by unit tests.
- **Rewording that reads like a person wrote it (Sam's review).** p3.7 produced "Built role-based access control and authentication on Firebase: three-role access (...) on Firebase Auth, ..." (terms stacked in front, "Firebase" twice). New checks 2e flag a word said twice, a term said twice in two forms ("Auth" and "authentication", a gloss in parentheses excepted), more than one added job term, and job terms stacked before a nearly unchanged source sentence. Lite's first drafts kept failing these and its fix rounds then dropped details, so for a single-source bullet code now places the term itself (`placeTerm`): it replaces the words that prove it or glosses a tool name, and keeps the result only if every fidelity check passes. Placement asks for one term per bullet and only one the bullet does not already state. A count may become the list it counts ("three-role" and "(admin, doctor, patient)"). Prompt p3.8 says the same, with fictional examples. On Sam's profile, 8 of 8 final runs: "Built role-based access control (admin, doctor, patient) on Firebase Auth, with per-role routes and reads." (once "with Firebase Auth") and "Integrated the Gemini API (LLM) to summarize medical reports into findings, test results, and recommendations.", 0 fix rounds, 11.0 to 14.8 s, one page.
- **Core skills are not trimmed (4d).** Every language, framework, library, database and tool his bullets or tech lines name stays, job terms first in each group; Firebase and LLM APIs sit under Backend, Three.js and Zustand under Frontend. A backspace character had replaced `\b` in the Frontend heading test (`\bui\b`) in the pushed 7ed6d9e, so a "UI" group was not recognised; fixed.
- **Score range on Sam's post, final 8 runs:** 84 to 91. The low run read the post differently (its master scored 86), so ±3 is not met on every run; the remaining variance is in P2's model-only keywords (soft skills, domains), not the dictionary terms.
