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
