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
Sam asked for the sample to say Pratik instead of Arif. The style tile now takes the name from the signed-in session and falls back to the fictional sample when nobody is signed in. Pratik's name is not written into the sample CV, `templates/resume-sample.tex` or any fixture: golden rule 5 keeps his data out of the repo, and a committed CV under his name with invented employers would be published with the open-source code. The real app shows his name from his own profile once he imports his CV (Phase 1).

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
