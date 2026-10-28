# Design

Pratik cares about good design. This doc is the design system and the screen-by-screen UX. Follow it exactly; when something is missing, decide in the spirit of the principles below and log it in `DECISIONS.md`.

## 1. Concept: index card and ballpoint

The product is an index card on a desk, written in blue ballpoint. A job description gets marked up the way you would mark a printed posting with a pen, and the CV is typeset to answer it. The vernacular:

- **The blue pen circle.** Matched keywords are circled in blue ballpoint: a slightly irregular, hand-drawn loop with a pale blue fill behind the word.
- **The red pen underline.** Missing keywords are underlined in red pen, slightly uneven like a hand stroke.
- **The index card.** Panels are white cards with a thin red rule across the top. Rows on the Today feed are separated by faint blue ruled lines, like the lines on a card.
- **The rubber stamp.** In the tracker, Applied is a slightly rotated red stamp.

Everything else stays quiet: a warm grey desk, white cards, blue ink, generous space. The pen marks are the loud thing.

(Changed 2026-10-29 from "the proofing desk" with a yellow highlighter and magenta proofmarks. See DECISIONS.md.)

## 2. Principles

1. **The job description is the working document.** Mark it up in place; do not hide matching inside a score.
2. **Evidence over vibes.** Every score shows its reasons on the same screen. No score without a "why".
3. **Quiet chrome, loud content.** Navigation and controls recede; job titles, CV text and pen marks carry the page.
4. **One step to the next action.** From any job: tailor, open, save, dismiss, each one click or one key.
5. **Honest states.** Unknown pay says "Pay not listed". Unclear eligibility says so. Estimates say "estimated".

## 3. Tokens

Define all tokens as CSS variables in `src/styles/tokens.css`, expose them to Tailwind, and never hard-code colors in components.

### Color

| Token | Light | Dark ("carbon paper") | Use |
|---|---|---|---|
| `--paper` | `#E6E4DF` | `#10162A` | App background: the desk |
| `--sheet` | `#FFFFFF` | `#182039` | Cards, panels, popovers |
| `--ink` | `#1F3A93` | `#DCE4F7` | Headings, titles, fit score, primary buttons, links, active nav, pen marks |
| `--body` | `#2A3145` | `#C9D0E0` | All running text |
| `--graphite` | `#4F5D80` | `#9AA6C4` | Secondary text |
| `--rule` | `#C9D8F0` | `#2A3557` | Ruled lines between rows, borders, dividers |
| `--control-edge` | `#6F7EA5` | `#6878A6` | Edges of text fields, selects and the segmented control (3:1, WCAG 1.4.11) |
| `--red-rule` | `#D7263D` | `#FF6B7A` | The red line at the top of a card. Decoration only, never text |
| `--redpen` | `#C41E3A` | `#FF6B7A` | Missing keywords, destructive actions, the Applied stamp |
| `--circle-fill` | `#DCE6FA` | `#2A3A6E` | Behind a circled keyword; the focus halo |
| `--circle-stroke` | `#1F3A93` (same as `--ink`) | `#8FB0FF` | The blue pen circle |
| `--ok` | `#186A41` | `#5CC48A` | Eligible, passed checks |
| `--caution` | `#8A5100` | `#F0A63C` | Pipeline warnings, eligibility unclear |

The light `--control-edge` is one step darker than the brief's `#7685AE`, which measured 2.88:1 on `--paper`.

**Text color rules** (readability):
- `--ink` (blue) is only for headings, page titles, job titles, the fit score, primary buttons, links, active nav items and the pen marks.
- `--body` is for all running text: job descriptions, the pasted job post in the tailor workspace, CV bullets shown in the app, profile text, fit reasons, settings copy, dialogs and toasts. A circled keyword keeps its `--body` color.
- `--graphite` is for secondary text: company and source lines, dates, hints, captions.
- Never set a paragraph or any multi-line text in `--ink`. Never put `--graphite` text on `--circle-fill` (4.47:1 in dark).

Rules:
- Primary buttons: `--ink` background, `--sheet` text. Secondary: `--sheet` with a `--rule` border and `--body` text.
- Pen marks are reserved for keywords: blue circles for matched, red underlines for missing. Do not use them decoratively.
- Cards and panels (the Today feed, dialogs, sheets, tracker cards, empty and error states) carry a 2 px `--red-rule` line across the top.
- Ruled lines (`--rule`, every 32 px) appear only on the Today feed (as row separators) and in empty states. Nowhere else.
- Never signal by color alone: missing keywords also get a "Missing" accessible label; matched ones get "Matched".
- Check every text and background pair for WCAG AA in both themes; `tests/unit/design/tokens.test.ts` enforces it and the results are in `DECISIONS.md`.
- Dark mode is carbon paper, not an inversion: deep blue-black paper, pale blue ink. The CV page stays white in dark mode, with a soft edge so it reads as a sheet.

### Type

- **UI:** IBM Plex Sans (400, 500, 600). Chosen for its engineering lineage, which suits a tool for a software engineer, and because it is not the default sans of every generated app.
- **Code:** IBM Plex Mono, only for the LaTeX source view and inline code. Do not use mono for labels or numbers in the UI.
- **CV preview:** Latin Modern Roman if a webfont build is available (it is the same design as the Computer Modern that his template renders in Overleaf); otherwise Source Serif 4. Check availability and license when building. The HTML preview must mirror `templates/resume-sample.tex`: small-caps name, section rules, one-line role headings with italic dates on the right, bold key phrases, italic `Tech:` lines.
- Load fonts with `next/font`, `display: swap`, subset Latin.

Scale (major third, base 16):

| Token | Size / line height | Use |
|---|---|---|
| `text-xs` | 12 / 16 | Fine print, timestamps |
| `text-sm` | 14 / 20 | Secondary text, chips, table cells |
| `text-base` | 16 / 24 | Body |
| `text-lg` | 20 / 28 | Job titles in lists, panel titles |
| `text-xl` | 25 / 32 | Page titles |
| `text-2xl` | 31 / 38 | Greeting on Today, onboarding step titles |
| `text-score` | 48 / 48, weight 600, tabular numbers | The ATS score |

Body line length max 72 characters. Sentence case everywhere. No all-caps labels. No letter-spaced eyebrows above headings.

### Space, radius, elevation

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64.
- Radius by role, not one radius for everything: inputs and buttons 8, chips 999 (pill), panels 12, the CV sheet 2 (paper has nearly square corners).
- Elevation: the CV sheet gets one soft shadow so it reads as paper; popovers and dialogs get a stronger one. Lists and panels use borders, not shadows.

### Motion

- Durations: 120 ms (hover, press), 200 ms (expand, collapse), 320 ms (dialogs, pane changes). Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- **The one signature moment:** when a tailoring finishes, the blue pen circles each matched term in the job description in reading order (each circle drawn with a stroke-dashoffset transition, about 30 ms stagger, total under 1.2 s) while the score counts up from the master CV score to the tailored score. Then the red pen underlines the missing terms.
- Marked job descriptions use a 28 px line height (body text is otherwise 16 / 24) so a circle never runs into a mark on the line above or below. Pen marks are sized to the letters, not the line.
- Other motion only answers an action: a job row expanding, a card moving between tracker columns, a toast confirming.
- No entrance animations on page load. No hover lifts on list rows.
- `prefers-reduced-motion`: all motion becomes instant; the score shows its final value.

## 4. App shell

```
Desktop (>= 1024 px)
┌────────┬──────────────────────────────────────────────────┐
│ rail   │ page                                             │
│        │                                                  │
│ Today  │                                                  │
│ Tailor │                                                  │
│ Tracker│                                                  │
│ Compan.│                                                  │
│        │                                                  │
│ Profile│                                                  │
│ Setting│                                                  │
└────────┴──────────────────────────────────────────────────┘

Mobile (< 768 px): bottom bar with Today, Tailor, Tracker, More.
```

- Rail: 220 px with labels, collapsible to 64 px icons. Active item: ink text with a 3 px ink bar on the left.
- Account item at the bottom of the rail: his Google avatar (24 px, initial on `--circle-fill` if there is no photo) and display name; avatar only when the rail is collapsed. It opens a small menu (an index card with the red rule) showing the signed-in email, "Settings" and "Sign out".
- Mobile: the "More" sheet ends with "Signed in as {email}" and a full-width "Sign out" secondary button.
- Sign out: no confirmation (nothing is lost). It clears the client data cache, ends the session and lands on /sign-in with a quiet "Signed out." note in `--graphite`. Never red: it is a secondary action, not a destructive one.
- Command palette (`Ctrl/Cmd + K`): jump to pages, "Tailor CV", "Run search now", "Sign out", search jobs and companies.
- Toasts bottom right (bottom center on mobile), auto-dismiss in 5 s, with Undo for dismiss and status changes.

## 5. Screens

### 5.1 Sign in
Centered, minimal. App name, one sentence ("Tailored CVs and fresh remote jobs, every morning."), "Continue with Google". If the email is not allowed: "This account is not on the allowlist for this deployment. Ask the owner to add your email."

### 5.2 Onboarding (a real sequence, so numbered steps are fine)
1. **Add your CV.** Large drop zone (PDF, DOCX, MD). After upload, show extracted text preview with a "Looks right" check.
2. **Add more sources (optional).** LinkedIn PDF (with a short how-to: on your LinkedIn profile, More, then Save to PDF), GitHub username, portfolio URL. Each shows what was found ("12 public repos, 6 with READMEs").
3. **Review your profile.** The profile editor (5.8) in a guided mode. Conflicts first, as a short list to resolve.
4. **Set what you are looking for.** Pre-filled preferences from P5. Plain-language controls: "Where can you work from?" with country and timezone, "What kind of remote?" segmented control (Worldwide / My region / Also on-site in...).
5. **First search.** Live progress ("Checking 214 companies... 38 jobs found, scoring the best ones") and jobs appearing as they are scored. Then go to Today.

Progress indicator at the top: step names, current one in ink, done ones with a check.

### 5.3 Today (the daily feed)

```
Good morning, Pratik                       Last checked at 6:32, 412 companies   [Run now]
24 new remote jobs that fit you
[Fit ▾] [Remote: worldwide + Asia] [Pay listed] [Direct only] [Seniority ▾]   (filter chips)

New since yesterday
───────────────────────────────────────────────────────────────────────────────────────────
 Senior Frontend Engineer                                                       Fit 88
 Lumen Labs   Direct from careers page (Ashby)   New company
 Remote, worldwide   $95k to $130k   2 days ago
───────────────────────────────────────────────────────────────────────────────────────────
 Full Stack Developer (React, Node)                                             Fit 81
 ...

Earlier this week
...
Eligibility unclear (7)          collapsed group, caution color note explaining why
```

- Greeting uses his first name from the profile and his timezone ("Good morning", "Good afternoon", "Good evening"). Never hard-code the name; this is open source.
- Rows on a white index card: each group ("New since yesterday", "Earlier this week") is one `--sheet` panel with the 2 px `--red-rule` across the top, and its jobs are rows separated by `--rule` lines, like the ruled lines on a card. Title in `text-lg` 600 in `--ink`. Company and source on the second line in `--graphite`. Third line in `--body`: remote scope, pay, posted date as separate inline items with spacing, not joined with dots.
- New since the last visit: a small `--ink` dot in the row's left margin, like a pen tick, with "New" in the accessible name.
- Fit score at the right: the number in tabular figures plus a thin 48 px bar.
- Clicking a row expands it in place (200 ms) on a faint `--ink-wash`: 2 to 3 reasons and the description preview in `--body`, main gaps with the red pen underline, actions: **Tailor CV** (primary), Open job, Save, Dismiss, Mark applied.
- "New company" chip appears on jobs from companies first discovered in the last 14 days.
- Keyboard: `j`/`k` move, `Enter` expand, `t` tailor, `o` open, `s` save, `d` dismiss (with Undo toast), `/` filter search.
- Pipeline warning bar (caution) when the last run is over 30 hours old.

Empty state: "No new matches today. 412 companies checked at 6:32. Add a company you like on the Companies page to watch it too." with a button "Add a company".

### 5.4 Tailor workspace

Desktop, three columns:

```
┌──────────────────────┬──────────────────────────────┬─────────────────────┐
│ Job description      │ [Preview] [LaTeX] [Changes]  │ Estimated ATS match │
│                      │ ┌──────────────────────────┐ │   86  (master 54)   │
│ Senior Frontend      │ │                          │ │ breakdown bars      │
│ Engineer at Lumen    │ │   CV on a paper sheet    │ │                     │
│                      │ │   page 1 of 1            │ │ Matched (14)        │
│ ...we need React and │ │                          │ │ [React] [TypeScript]│
│ ▓TypeScript▓, plus   │ │                          │ │ Missing (3)         │
│ GraphQL (missing)... │ │                          │ │ GraphQL  I have this│
│                      │ └──────────────────────────┘ │                     │
│ [Edit job details]   │                              │ [Open in Overleaf]  │
│                      │                              │ Copy LaTeX  .tex    │
└──────────────────────┴──────────────────────────────┴─────────────────────┘
```

- **Before tailoring:** the left column is a large paste area with the hint "Paste the full job post. Messy text is fine." and `Ctrl/Cmd + Enter` to run. Center shows his master CV preview. Right shows the master CV score once parsing finishes.
- **Progress:** two named steps shown inline in the right column: "Reading the job" then "Tailoring your CV". No spinner-only states.
- **Left column after parsing:** the job text in `--body` with pen marks. Matched terms are circled in blue pen; missing terms get the red pen underline. Hovering a mark shows where it appears in the CV and scrolls the preview to it.
- **Center column tabs:**
  - Preview: the CV on a white sheet at true letter or A4 proportions with a page boundary line and "1 page" / "2 pages" indicator. Bullets are editable on click (inline, wording only; the validator re-runs on blur and flags problems inline).
  - LaTeX: read-only code view in Plex Mono with line numbers and Copy.
  - Changes: side-by-side or inline diff versus the master CV: reordered sections, rewritten bullets (old struck through in graphite, new in ink), dropped items.
- **Right rail:** score with breakdown (from `AtsReport.components`), Matched and Missing chip lists, parseability checks, "Removed for accuracy" panel when the validator dropped anything, options (length 1 or 2 pages, emphasis, tone) with "Re-tailor".
- **Missing keyword chip actions:** "I have this" opens a small sheet: "Where have you used GraphQL?" with a picker of his roles and projects plus a one-line description. Saved to the master profile as `user_added`, then re-tailor. "Not for this job" hides it.
- **Open in Overleaf** is the primary button. After click, toast: "Opened in Overleaf in a new tab."
- Mobile: stacked panes with a segmented control (Job / CV / Score), Overleaf button pinned at the bottom.

### 5.5 Job detail (`/jobs/[id]`)
Full description (sanitized HTML, typographically styled), source line and attribution link, remote scope with the evidence quote, salary with "approx. annual USD", fit reasons and gaps, history (seen, saved, tailored). Actions as in the feed.

### 5.6 Tracker
Columns Saved, Applied, Interviewing, Offer, Closed. Compact cards with the red rule on top: title, company, date moved, link to the tailored CV. Cards in Applied carry a slightly rotated red rubber stamp ("Applied", `--redpen`, 2 px border) in the top-right corner. Drag and drop with keyboard alternative (a "Move to" menu). Column counts in headers.

### 5.7 Companies
Table: name, website, ATS (or "careers site"), open roles, last checked, discovered via, flags (staffing agency, paused, muted). Row actions: mute, confirm ATS match, remove. "Add a company" dialog: paste a careers or website URL, show detection result live ("Found a Greenhouse board with 23 open roles"), then "Track this company".

### 5.8 Profile
A document-like editor that looks close to a CV, not a form dump. Sections: basics, experience, projects, education, skills, certifications. Every item shows small source badges (CV, LinkedIn, GitHub, portfolio, added by you). Inline edit, drag to reorder bullets, add item. Version history in a side sheet with restore. Conflicts banner at the top until resolved.

### 5.9 Settings
Plain sections: Account (the signed-in email and a "Sign out" secondary button), Search preferences, CV defaults, AI provider (with the privacy note in a calm callout: "On Gemini's free tier, Google can use what you send to improve its products. Use a paid key or another provider if you would rather it did not."), Sources (tier toggles, keys status shown as set or not set, never the key), Theme, Data (export, delete all).

## 6. Components to build (restyled shadcn/ui where possible)

Button (primary, secondary, ghost, destructive; sizes sm/md), Input, Textarea (auto-grow), Select, Combobox, Segmented control, Chip (filter chip; keyword chip: matched is a pen-circled word, missing is a red-underlined word), Stamp (Applied), Panel (white card with the red rule), Tabs, Dialog, Sheet, Popover, Tooltip, Toast, Accordion row (for job rows), Data table (Companies), Kanban column and card, Account menu (avatar, display name, Settings, Sign out), Progress steps, Skeletons for every list and panel, Score display (number + breakdown bars), Marked text renderer (pen circles for matched ranges, red underlines for missing ranges, with the drawing animation), Pen circle and Pen underline (seeded SVG paths, so each word gets its own slightly irregular stroke), Diff view, Code view, CV sheet preview, Empty state, Error state, Command palette.

## 7. States checklist (every screen)

- Loading: skeletons that match the final layout. No layout shift when data arrives.
- Empty: one sentence on what is happening plus the next action.
- Error: what happened and what to do, with a retry. Errors do not apologize. Example: "Gemini's rate limit was reached. Your CV will finish tailoring in about a minute, or you can try again now."
- Partial: show what loaded and label what did not ("Pay not listed", "Not scored yet").
- Offline: keep showing cached feed with a quiet banner.

## 8. Accessibility

- WCAG 2.2 AA. Visible focus: 2 px `--ink` outline plus a 3 px `--circle-fill` halo.
- Full keyboard paths for every action, including drag and drop alternatives.
- Live regions for tailoring progress and toasts.
- Highlights in the JD are `<mark>` elements with accessible labels ("matched keyword", "missing keyword").
- Touch targets at least 44 px on mobile.

## 9. Writing

- Write for Pratik, in plain words. Name things by what they do for him ("Tailor CV", "Open in Overleaf", "Run search now"), not by system internals ("Trigger pipeline").
- Sentence case. Active voice. No em dashes. No filler.
- Buttons say exactly what happens, and the result uses the same verb: "Save" leads to "Saved", "Dismiss" leads to "Dismissed. Undo".
- No arrows appended to button or link text.
- Numbers: "2 days ago", "$95k to $130k a year", "approx. $64k a year".
- Never say "AI-powered" or "magic" in the UI.

## 10. No generic AI look (hard requirement)

Pratik strongly dislikes the generic "AI-generated app" look. Treat this section as a gate, not a suggestion. A screen that fails any item below is not done.

### 10.1 Banned patterns

Visual:
- Default shadcn/ui appearance: zinc or slate grays, the stock radius on everything, stock focus rings, stock card component as the main layout unit. Restyle every primitive to our tokens.
- Inter, Geist, Roboto or system-ui as the UI face. Use IBM Plex Sans.
- Identical rounded cards with the same soft gray shadow for every piece of content. Lists are rows.
- Gradients of any kind as decoration, gradient text, glows, glassmorphism, blurred blobs, noise textures. (The ruled index-card lines are the one exception: hairlines drawn with a repeating gradient, only on the Today feed and in empty states.)
- Purple, violet or blue-to-purple "AI" accents. Sparkle, magic wand, robot or brain icons. Emoji in the UI.
- Dashboard stat tiles ("Total jobs: 1,234", "Applications: 12") at the top of pages. Numbers appear only where they help a decision, next to what they describe.
- A big number with a tiny label and a colored accent as a hero.
- An icon next to every heading or label. Icons only where they speed up scanning (nav rail, row actions). One icon set, one weight: Phosphor, regular weight, 20 px in the rail, 16 px inline.
- Uppercase tracked-out labels, eyebrow text above headings, middle-dot meta strings, monospace for small data labels, arrows appended to button text.
- Numbered markers (01, 02, 03) on anything that is not a real sequence.
- Entrance animations, fade-up-on-scroll, hover lifts, bouncing loaders.
- Stock illustrations or 3D blobs in empty states.
- Tinted near-black (`#0B0B0B`, `#111`) for dark mode. Our dark mode is deep ink blue (`--paper` dark).

Copy:
- "Supercharge", "unlock", "elevate", "seamless", "effortless", "AI-powered", "magic", "your journey", "Let's get started!", exclamation marks.
- Marketing copy inside the app. The app talks like a precise colleague.
- Placeholder text like "Lorem ipsum" or "John Doe" in anything shown to Sam or Pratik. Use realistic fictional data.

### 10.2 Required, distinctive elements

These are what make the app feel like its own thing. All must be present by the end of Phase 2:
- Blue pen circles around matched keywords in the job description, hand-drawn and slightly irregular, with the signature drawing moment.
- Red pen underlines for missing keywords.
- Index cards: white panels with the 2 px red rule across the top; ruled blue lines between rows on the Today feed and in empty states.
- The CV shown as a real paper sheet with true page proportions and a page boundary.
- Job rows in Today that read like a well-set list, with fit score in tabular figures and a thin bar.
- The red Applied stamp in the tracker.
- The carbon-paper dark mode with the CV sheet still white.
- Running text in `--body`, never in `--ink`.

### 10.3 Style tile first

Before building any real screen (Phase 0), build `/design` (dev only): a style tile page showing all tokens in both themes, the type scale with real content (a job title, a CV bullet, a JD paragraph with pen marks), every component and state from section 6, the score display, and the pen drawing moment. Stop and ask Sam to review it with Pratik. Do not build screens until they approve. Record their feedback in `DECISIONS.md`.

### 10.4 The squint test

For each finished screen, take a screenshot and ask: "If I removed the logo, could this be any SaaS template?" If yes, it fails. Fix by strengthening the subject-specific elements (marks, paper, type, ink), not by adding decoration.

### 10.5 Side-by-side test

Put the screenshot next to a stock shadcn/ui example of a similar screen. If they look alike at a glance, redo the screen.

## 11. Review loop

For every UI task: build, run, screenshot at 1440, 1024 and 390 px in light and dark, check sections 3 to 10 one by one, fix, and only then mark done. Before the end of each phase, do one pass that removes one unnecessary element per screen.
