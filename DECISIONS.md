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

Open question for Phase 2: ARCHITECTURE.md section 6 mentions `inputenc utf8` + `fontenc T1`, but the template loads neither. Modern LaTeX defaults to UTF-8 input, so accented Latin letters work, but with OT1 they are built from accents (worse copy and paste for ATS). Adding `\usepackage[T1]{fontenc}` would change the look to cm-super. Decide with a compile test in Phase 2.

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

### Style tile review
Waiting for Sam and Pratik. Feedback will be recorded here.
