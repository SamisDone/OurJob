# Product requirements

## 1. Summary

A personal job-search workspace for one software engineer (Pratik), open source so anyone can self-host their own copy. It turns his real background into tailored, ATS-friendly LaTeX CVs in seconds, and every morning shows fresh remote jobs gathered from companies' own career pages, remote job boards and job aggregator APIs, deduplicated, with the company-direct version preferred.

## 2. Users

- **Primary user: Pratik.** Software engineer, applying to remote roles. Cares about design quality and speed. Uses Overleaf for his CV. Will use the app daily.
- **Secondary: anyone who self-hosts it.** Each deployment is single-owner (one person's profile), with an email allowlist. Multi-tenant SaaS is out of scope.

## 3. Goals

1. Paste a job description and get a tailored, truthful CV in Overleaf in under 60 seconds.
2. Show clearly which job keywords he matches and which he lacks.
3. Deliver 10 to 40 relevant, real, fresh remote jobs per day without him searching.
4. Surface lesser-known, well-paying remote companies, not only famous brands.
5. Run on free tiers for one user.

## 4. Non-goals (v1)

- Auto-applying to jobs or filling application forms.
- Scraping HTML from LinkedIn, Indeed, Glassdoor or any site whose terms forbid it. (Their listings may still arrive through an aggregator API we are allowed to use, such as JSearch.)
- Writing cover letters (possible v2).
- Multi-user accounts, teams, billing.
- Compiling PDFs on the server (Overleaf compiles; we show an HTML preview).

## 5. Features

### F1. Onboarding and master profile

**Inputs**
- CV file: LaTeX `.tex` (preferred; Pratik keeps his CV in LaTeX), PDF, DOCX, or Markdown (max 5 MB).
- LinkedIn profile as the PDF from LinkedIn's "Save to PDF" (we never fetch linkedin.com).
- GitHub username (public data via the GitHub REST API).
- Portfolio URL (fetched once, text extracted; if the site is a JavaScript app with little server-rendered text, show what was found and let him paste text instead).
- Optional: extra notes he types ("things my CV leaves out").

**Behavior**
1. Extract text from each source (see ARCHITECTURE, "Ingestion").
2. The LLM merges all sources into one structured **master profile** (schema in AI_PROMPTS, P1), with every item tagged by which source(s) it came from.
3. Conflicts between sources (for example, different end dates for the same job) are listed for him to resolve, never silently picked.
4. He reviews everything in a profile editor and confirms. Nothing is used for tailoring until confirmed.
5. He can re-import a source any time; the app shows a diff against the current profile and lets him accept changes item by item.

**Acceptance**
- Uploading a fictional sample CV produces a profile where every experience, project, education entry and skill appears, with correct dates.
- Every profile item shows its source(s).
- Editing and saving is instant and versioned (he can restore an earlier version).

### F2. Search preferences

Pre-filled from the profile (P5), editable:
- Target titles (for example "Frontend Engineer", "Full Stack Developer").
- Core skills to weight higher.
- Seniority: intern, junior, mid, senior (multi-select).
- Location: his country and timezone.
- Remote scope he accepts: worldwide remote, remote in specific regions or countries, and optionally on-site or hybrid in named cities.
- Max timezone difference he will work with.
- Minimum annual salary in USD (optional) and whether to show jobs with no listed pay.
- Employment types: full-time, contract, part-time.
- Excluded companies and excluded keywords (for example "clearance", "crypto").
- "Prefer lesser-known companies" toggle (on by default).

### F3. CV tailoring

**Flow**
1. He pastes a job description into a large text area, or clicks "Tailor CV" on a job from the feed (pre-fills it).
2. The app cleans the pasted text (strips nav menus, cookie text, "Apply now" buttons and similar junk) and parses it (P2) into a job spec: title, company, must-have skills, nice-to-have skills, responsibilities, seniority, keywords with synonyms.
3. He sees the parsed spec and can fix it (for example, move a keyword from nice-to-have to must-have) before tailoring. This step is skippable; default is to continue automatically.
4. Tailoring (P3) produces a structured tailored CV that references master profile item IDs.
5. The validator checks it (AI_PROMPTS, "Validator"). Anything that fails is fixed by retry or dropped, and the UI shows what was dropped.
6. A deterministic renderer turns the structured CV into LaTeX using the template in `templates/resume-sample.tex`.
7. Results screen shows: HTML preview of the CV, ATS score with breakdown, keyword coverage, a diff against his master CV, the LaTeX source, and actions.

**Keyword rule**
- Every must-have and nice-to-have keyword the job lists that **he actually has** (present in the master profile, including synonyms) must appear in the tailored CV, using the job's exact wording.
- Keywords he does not have are listed as **gaps**. For each gap he can:
  - "I have this": opens a small form to add the skill or experience to his master profile, with a required line on where he used it. Then re-tailor.
  - "Ignore for this job".
- The app never adds a gap keyword on its own.

**Actions on the result**
- **Open in Overleaf**: one click creates a new Overleaf project with the LaTeX (see ARCHITECTURE, "Overleaf").
- Copy LaTeX.
- Download `.tex`.
- Re-tailor with options: length (1 page / 2 pages), emphasis (for example "lead with projects"), tone (concise / detailed).
- Edit any bullet inline before export (edits are allowed only to wording; the validator re-runs).
- Save the tailoring to history, linked to the job if it came from the feed.

**Acceptance**
- For a sample JD, every matched keyword appears in the output; no gap keyword appears.
- No number appears in a tailored bullet unless it appears in that bullet's source items.
- The LaTeX compiles in Overleaf with pdflatex without edits (test by opening several outputs).
- The output uses his current CV format (`templates/resume-sample.tex`): same preamble, macros, section names, one-line role headings, bold key phrases and `Tech:` lines. Side by side with his current CV, it should look like the same document, tailored.
- A 1-page target stays on 1 page.
- Special characters in his data (`&`, `%`, `#`, `_`, `$`, accents, Bangla names in Latin script) are escaped correctly.

### F4. ATS score

- Shown as a number from 0 to 100, labeled "Estimated ATS match".
- Breakdown by component, matched keywords, missing keywords, and parseability checks.
- Shown for both his master CV and the tailored CV against the same job, so he sees the improvement.
- Deterministic: same CV + same job spec = same score. Formula in `ATS_SCORING.md`.
- Tooltip explains that real ATS systems differ and this is an estimate.

### F5. Daily job feed ("Today")

**Rules for a job to appear**
1. Fetched from an allowed source in one of the three tiers (JOB_SOURCES). If the same job is found in several sources, one card is shown, using the company-direct version when it exists.
2. Posted within the last 7 days, using a reliable post date (JOB_SOURCES, "Dates").
3. Remote and open to his location, or matching his on-site cities. Unknown eligibility is shown in a separate, clearly labeled group, never mixed in as eligible.
4. Not from an excluded company, not matching excluded keywords, not from a staffing agency (default; toggle to show).
5. Fit score above a threshold.

**Each job shows**
- Title, company, company website.
- Source line: "Direct from Acme's careers page (Greenhouse)" for tier 1, or "Found on Remotive" with the source's required attribution link for tiers 2 and 3. If a third-party listing's apply link points to a company ATS we can read, the app fetches the direct version and shows that instead.
- Posted date ("2 days ago"), location and remote scope, timezone notes.
- Salary when listed, with original currency and an approximate annual USD figure.
- Fit score with 2 or 3 short reasons and the main gaps.
- Badge if the company is new to the app (lesser-known discovery).
- Actions: Tailor CV, Open job (company's apply page), Save, Dismiss, Mark applied.

**Feed behavior**
- New jobs since his last visit are marked.
- Default sort: fit score, then pay, then date. Other sorts: newest, highest pay.
- Filters: remote scope, salary listed, min salary, seniority, employment type, source tier ("Direct from company only" toggle), saved.
- Dismissed jobs never return (same job ID or same normalized title + company within 30 days).
- Header shows pipeline health: last run time, jobs checked, companies checked, errors. If the last run is over 30 hours old, show a warning with a "Run now" button.

### F6. Saved jobs and application tracker

Columns: Saved, Applied, Interviewing, Offer, Closed. Drag between columns. Each card links to its tailored CV. Notes per job. (Build in Phase 5; keep it simple.)

### F7. Companies

- List of known companies with: website, ATS type, number of open roles, last checked, how it was discovered, staffing agency flag, mute toggle.
- "Add company": paste a careers page URL or company website. The app detects the ATS and starts tracking it.
- Muted companies are skipped.

### F8. Settings

- Account: shows the signed-in email and a Sign out button. Sign out is also in the account menu at the bottom of the desktop rail, at the bottom of the mobile "More" sheet and in the command palette. Signing out needs no confirmation, clears all client-side cached data, and returns to the sign-in page with a "Signed out" note.
- Profile sources (re-import).
- Search preferences (F2).
- LLM provider and model, with a clear privacy note: on Gemini's free tier, submitted content can be used by Google to improve its products. Offer a paid key or another provider for people who do not want that.
- CV defaults: page length, spelling (US / UK), date format, section order.
- Display name for greetings in the app (can differ from the name printed on the CV).
- Theme: system, light, dark.
- Export all data (JSON) and delete all data.

## 6. Non-functional requirements

- **Performance:** first load under 2 s on a normal connection; tailoring under 45 s end to end at p50; feed page under 1 s from cache.
- **Accessibility:** WCAG 2.2 AA, full keyboard use, visible focus, reduced motion respected.
- **Responsive:** fully usable on phone width (360 px) for reading the feed and triggering tailoring; tailoring workspace is best on desktop but must work on mobile with stacked panes.
- **Privacy:** CV text is never logged. LLM calls happen server side only. Data stays in his own database.
- **Reliability:** the daily pipeline is idempotent; a failed source never blocks others; partial results are saved.
- **Cost:** runs on free tiers for one user (see ARCHITECTURE, "Free tier budget").

## 7. Success metrics (for Sam to judge v1)

- Pratik uses it at least 4 days a week for 2 weeks.
- He applies to at least 5 jobs found by the feed.
- He rates tailored CVs as "send with minor edits" or better on most uses.
