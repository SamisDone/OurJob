# Design

Pratik cares about good design. This doc is the design system and the screen-by-screen UX. Follow it exactly; when something is missing, decide in the spirit of the principles below and log it in `DECISIONS.md`.

## 1. Concept: a clean, familiar shadcn/ui app

OurJob looks and feels like a well-made, standard shadcn/ui app, in the spirit of the official shadcn examples, Linear and Vercel: neutral surfaces, clear type, generous space, and components people already know how to use. The product earns its character from what it shows (real jobs, his CV, honest scores), not from decoration.

- **Standard components, standard look.** shadcn/ui on Radix with its current default style (nova), base color neutral, CSS variables on. Use the components as the CLI ships them; change them only to add the status variants in section 3 or to meet section 8.
- **Neutral by default, color for meaning.** Everything is black, white and neutral grays. Color appears only through four status colors (success, warning, destructive, info) and only for what they mean.
- **Calm and roomy.** 16 px body text, comfortable table rows, wide page padding, one primary button per view, details on demand.

(Changed 2026-10-29 from "index card and ballpoint", which Sam and Pratik found confusing and cramped. See DECISIONS.md.)

## 2. Principles

1. **The job description is the working document.** Show what matched and what is missing in the job post itself; do not hide matching inside a score.
2. **Evidence over vibes.** Every score shows its reasons on the same screen. No score without a "why".
3. **Quiet chrome, clear content.** Navigation and controls recede; job titles, CV text and scores carry the page.
4. **One step to the next action.** From any job: tailor, open, save, dismiss, each one click or one key.
5. **Honest states.** Unknown pay says "Not listed". Unclear eligibility says so. Estimates say "estimated".
6. **Plain labels.** "88, Strong match", not "Fit 88". "You're missing", not "Gaps".

## 3. Tokens

The theme lives in `src/app/globals.css` as shadcn/ui CSS variables (`:root` and `.dark`), exposed to Tailwind with `@theme inline`. `components.json` records the setup: style `radix-nova`, base color `neutral`, CSS variables on, icon library `lucide`. Never hard-code colors in components; use the theme classes (`bg-background`, `text-muted-foreground`, `bg-success-soft`, ...).

### Color

The neutral palette is the shadcn neutral theme, unchanged, with one exception: the dark sidebar's primary color is neutral, not the stock blue, because blue is reserved for info.

Four status colors, each a text color and a soft background, in both themes:

| Token | Light (text on soft) | Dark (text on soft) | Means |
|---|---|---|---|
| `--success`, `--success-soft` | `#107D32` on `#E9F7EE` | `#3FCF6E` on `#0F2A19` | Strong match, open to you, applied, matched keywords |
| `--warning`, `--warning-soft` | `#A35200` on `#FFF4E0` | `#F5A524` on `#2E2008` | Partial match, unclear location, late search |
| `--destructive`, `--destructive-soft` | `#C4232E` on `#FDECEC` | `#FF6369` on `#3A1416` | Missing skills and keywords, errors, delete |
| `--info`, `--info-soft` | `#0062CC` on `#EAF3FF` | `#52A8FF` on `#0B2340` | New jobs, links, focus (`--ring` is `--info`) |

Rules:
- Use color only for these meanings. Everything else stays neutral: no colored headings, accents or decorative fills.
- Badge has a variant for each (`success`, `warning`, `destructive`, `info`), plus the stock `default`, `secondary` and `outline`. Alert has `default`, `destructive` and `warning`.
- Never signal by color alone: a status badge always has words ("Strong match", "Missing"), and highlights in the job post carry "matched keyword" or "missing keyword" in their accessible name.
- Every status pair passes WCAG AA (4.5:1) as text on its soft background and on the page and card backgrounds, in both themes. `tests/unit/design/tokens.test.ts` enforces it.
- The CV preview stays a white sheet with black type in both themes (`--cv-paper`, `--cv-ink`), because it shows what prints.

### Type

- **UI:** Geist Sans for everything, loaded with `next/font` (`--font-geist-sans`).
- **Numbers:** Geist Mono (`--font-geist-mono`) only for numbers: scores, pay, dates, times, counts. Use the `num` utility (Geist Mono with tabular figures). The LaTeX source view also uses Geist Mono.
- **CV preview:** Latin Modern Roman (the same design as the Computer Modern his template renders in Overleaf). The HTML preview mirrors `templates/resume-sample.tex`: small-caps name, section rules, one-line role headings with italic dates on the right, bold key phrases, italic `Tech:` lines.

Sizes are Tailwind's defaults. Body text is 16 px (`text-base`). Table text is 14 px (`text-sm`) at the smallest; nothing a person reads to decide is smaller than 14 px. Page titles are `text-2xl` semibold. Body line length max 72 characters. Sentence case everywhere. No all-caps labels.

### Space, radius, elevation

- Page padding: 24 px on phones, 32 px from `md`, 40 px from `lg` (`Page` in `src/components/shell/page-states.tsx`). Wide pages (tables, the tailor workspace) go up to 1440 px; reading pages to 1024 px.
- Table rows are about 56 px tall (`h-14` cells), with 16 px cell padding.
- Radius and elevation are shadcn's defaults (`--radius: 0.625rem`). Cards and tables use borders; popovers, menus and sheets use the stock shadows.

### Motion

- shadcn's stock motion (tw-animate-css) for dialogs, sheets, menus and toasts. Nothing else animates on its own.
- Other motion only answers an action: a sheet opening, a card moving between tracker columns, a toast confirming.
- No entrance animations on page load. No hover lifts.
- `prefers-reduced-motion`: all motion becomes instant.

## 4. App shell

```
Desktop (>= 768 px)
┌──────────────┬──────────────────────────────────────────────────┐
│ [■] OurJob   │ [≡] | Today                       [Search  Ctrl K] │
│ Search       ├──────────────────────────────────────────────────┤
│  Today       │ Page title                                         │
│  Tailor      │ One sentence on what the page is for.              │
│  Tracker     │                                                    │
│  Companies   │                                                    │
│ You          │                                                    │
│  Profile     │                                                    │
│  Settings    │                                                    │
│              │                                                    │
│ [avatar] Name│                                                    │
└──────────────┴──────────────────────────────────────────────────┘

Mobile (< 768 px): the same Sidebar opens as a sheet from the header's menu button.
```

- One shell for every signed-in page, onboarding and the signed-in 404 included. Only sign-in and the dev-only style tile have no shell. It never re-mounts or flashes between pages.
- **Sidebar:** the shadcn `Sidebar` with `collapsible="icon"`, a `SidebarRail`, and `SidebarInset` for the page. Groups "Search" (Today, Tailor, Tracker, Companies) and "You" (Profile, Settings). Lucide icons. Collapsed, items show tooltips. The open or collapsed state is remembered in shadcn's `sidebar_state` cookie, read on the server so the first paint has the right width. `Ctrl/Cmd + B` toggles it.
- **Header:** `SidebarTrigger`, a vertical separator, breadcrumbs (the section, then the detail page: "Tailor / Tailored CV", "Today / Job", "Profile / Set up"), and a search button on the right that opens the command palette.
- **Active item on every route:** detail pages light up their parent (`/jobs/[id]` is Today, `/tailor/[id]` is Tailor), onboarding lights up Profile, and the 404 lights up nothing.
- **Mobile:** the Sidebar's built-in sheet, opened from the header. Choosing a page closes it.
- Pages that need a confirmed profile still open: an `Empty` state, "Finish your profile first.", one sentence on why the page is empty, and "Continue onboarding" (to the review step when a draft profile exists). Screens not built yet show "Coming soon in this build." with one sentence on what arrives and when.
- **Account menu** in the sidebar footer: a `DropdownMenu` on a large `SidebarMenuButton` with his Google avatar (initial as fallback), name and email. It holds the email, "Settings", a "Theme" submenu (System, Light, Dark) and "Sign out".
- **Sign out:** no confirmation (nothing is lost). It clears the client data cache, ends the session and lands on /sign-in with a quiet "Signed out." note. It is a plain menu item or an outline button, never destructive.
- **Theme:** next-themes with `attribute="class"`, System by default, Light or Dark by choice, stored under `ourjob-theme`.
- **Command palette** (`Ctrl/Cmd + K`, shadcn `Command` in a dialog): jump to pages, "Tailor CV", "Run search now", "Sign out", search jobs and companies.
- **Toasts:** Sonner, bottom right (bottom center on phones), 5 s, with Undo for dismiss and status changes.

## 5. Screens

Every page starts with a clear title and one sentence saying what the page is for (`PageHeader`), with that page's actions on the right. One primary (default variant) button per view; everything else is outline, ghost or in a menu. Details open on demand in a Sheet, Collapsible or Dialog instead of crowding the page.

### 5.1 Sign in
Centered on a muted background: the OurJob mark, then a Card with "Sign in", one sentence ("Tailored CVs and fresh remote jobs, every morning.") and "Continue with Google". If the email is not allowed, a destructive Alert: "This account is not on the allowlist for this deployment. Ask the owner to add your email."

### 5.2 Onboarding (a real sequence, so numbered steps are fine)
1. **Add your CV.** The page heading says what to do. A Card holds the upload area: a bordered drop zone with one line, "LaTeX (.tex), PDF, Word (.docx) or Markdown, up to 5 MB. Only you can see it.", and a "Choose a file" button. Dropping a file anywhere on the card works; while a file is dragged over it, the line reads "Drop to upload". Under the card: "Using Overleaf? Open Menu, then Download source, and upload the .tex file." and a link, "Paste your CV as text instead", that opens a text area. After upload, show extracted text preview with a "Looks right" check.
2. **Add more sources (optional).** LinkedIn PDF (with a short how-to: on your LinkedIn profile, More, then Save to PDF), GitHub username, portfolio URL. Each shows what was found ("12 public repos, 6 with READMEs").
3. **Review your profile.** The profile editor (5.8) in a guided mode. Conflicts first, as a short list to resolve.
4. **Set what you are looking for.** Pre-filled preferences from P5. Plain-language controls: "Where can you work from?" with country and timezone, "What kind of remote?" as a RadioGroup (Worldwide / My region / Also on-site in...).
5. **First search.** (Needs the job pipeline. Until it exists, the last screen says the daily search is not switched on yet.) Live progress ("Checking 214 companies... 38 jobs found, scoring the best ones") and jobs appearing as they are scored. Then go to Today.

A simple step indicator at the top: step names, the current one in the foreground color, done ones with a check. Done steps are links back to that step; future steps are muted text. Steps 2 onward have a Back button. On phones it is one line: "Step 4 of 5: What you want". Forms use the shadcn Field components with react-hook-form and zod.

Layout: inside the app shell like every signed-in page (Profile is the active nav item), at a 640 px reading width.

### 5.3 Today (the daily feed)

```
Today                                         Last search at 6:32 AM, 412 companies checked  [Run search now]
Fresh remote jobs from the last 7 days, ranked by how well they fit you.

[All 9] [Strong match 4] [Pay listed 7] [Saved 2]                               [Filter by role or company]
┌──────────────────────────────────────────────┬────────────────────┬────────────────┬────────────┐
│ Role and company                             │ Match ↕            │ Pay per year ↕ │ Posted ↕   │
├──────────────────────────────────────────────┼────────────────────┼────────────────┼────────────┤
│ Senior Backend Engineer  [New]               │ [88, Strong match] │ $95k to $130k  │ 2 days ago │
│ Lumen Labs  [New company]                    │                    │                │            │
└──────────────────────────────────────────────┴────────────────────┴────────────────┴────────────┘
```

- A Table built with TanStack Table (v9, `useTable` with the sorting feature): role and company, match (a Badge, "88, Strong match"), pay per year, posted. Sorted by match by default; match, pay and posted sort from their headers. Rows are about 56 px.
- Filters as an outline ToggleGroup with counts: All, Strong match (80 and up), Pay listed, Saved. A search box filters by role or company.
- "New" (info badge) on jobs new since the last visit; "New company" (outline badge) on companies first discovered in the last 14 days.
- On phones, pay and posted move under the title as one muted line, so the table fits 390 px.
- Clicking a row, or its title for keyboard users, opens the job in a Sheet on the right with labeled facts: Match, Where (with "Open to you", "Location unclear" or "Not open to you"), Pay ("Not listed" when unknown), Posted, Source (and "direct from the company" for tier 1). Then "Why it fits" (2 to 3 reasons) and "You're missing" (destructive badges). Footer: **Tailor my CV** (default) and **Open posting** (outline), plus a Save icon button with a tooltip.
- Match labels: 80 and up "Strong match" (success), 60 to 79 "Partial match" (warning), under 60 "Weak match" (secondary), unscored "Not scored yet" (outline).
- Keyboard: `j`/`k` move, `Enter` opens, `t` tailor, `o` open, `s` save, `d` dismiss (with Undo toast), `/` filter search.
- Warning Alert when the last search finished more than 30 hours ago.

Empty state: "No new matches today. 412 companies checked at 6:32 AM. Add a company you like on the Companies page to watch it too." with a button "Add a company".

### 5.4 Tailor workspace

```
Tailor                                                    [New job post] [Export ▾] [Open in Overleaf]
Your CV for Senior Backend Engineer at Lumen Labs, ready to open in Overleaf.

┌ [Preview] [LaTeX] [Changes 3] ───────────────┐  ┌ Estimated ATS match ─────────┐
│ [Fit width] [100%] [125%]   Open full size   │  │ 74 out of 100   [↑ 20]        │
│ ┌──────────────────────────────────────────┐ │  │ Your master CV scores 54.     │
│ │                                          │ │  │ Required keywords  ▓▓▓▓▓░ 31.5│
│ │        CV on a white sheet               │ │  │ ...                           │
│ │                                          │ │  │ Matched 8: [Go] [PostgreSQL]  │
│ └──────────────────────────────────────────┘ │  │ Missing 4: [Terraform] ...    │
│ 1 page, US Letter                            │  └───────────────────────────────┘
└──────────────────────────────────────────────┘  ┌ Job post ───────────── Edit ──┐
                                                  │ ...we need Go and Terraform...│
                                                  └───────────────────────────────┘
```

- **Before tailoring:** a Card with a Textarea for the job post ("Paste the full job post. Messy text from a select-all is fine."), `Ctrl/Cmd + Enter` to run, and **Tailor my CV** as the one primary button.
- **Progress:** a Card with two named steps, "Reading the job" then "Tailoring your CV" (a check when done, a Spinner while running), and the result layout in skeletons. No spinner-only states.
- **After tailoring:** from 1280 px, the CV tabs on the left and a 400 px column on the right with the score Card above the job post Card. Below that, one column in this order: score, CV, job post.
- **Tabs:** Preview (the CV on a white sheet at true letter proportions, zoom Fit width / 100% / 125%, "Open full size" in a Dialog, page count), LaTeX (read-only Geist Mono with line numbers and Copy), Changes (reworded, moved, left out, with old wording struck through).
- **Score Card:** "Estimated ATS match", the number out of 100 with the gain over the master CV as a success badge, a Progress bar with points for each part of the score (`AtsReport.components`), then Matched (success badges) and Missing (destructive badges).
- **Job post Card:** the job text with matched words on a `--success-soft` wash and missing words on a `--destructive-soft` wash, as `<mark>` elements. No circles, no underlines.
- **Missing keyword actions:** "I have this" opens a small Sheet: "Where have you used GraphQL?" with a picker of his roles and projects plus a one-line description. Saved to the master profile as `user_added`, then re-tailor. "Not for this job" hides it.
- **Open in Overleaf** is the primary button. After click, toast: "Opened in Overleaf in a new tab." Copy LaTeX and Download .tex sit in an "Export" menu.
- **CV readability:** the sheet is never drawn narrower than 612 px (9 pt text at 9 px). Where the column is narrower, it scrolls sideways inside its frame, with a note saying so. The sheet matches the pdflatex output: black text, the name in small caps, section headings bold upright, no app colors.

### 5.5 Job detail (`/jobs/[id]`)
Full description (sanitized HTML, typographically styled), source line and attribution link, remote scope with the evidence quote, salary with "approx. annual USD", why it fits and what you're missing, history (seen, saved, tailored). Actions as in the job sheet.

### 5.6 Tracker
Columns Saved, Applied, Interviewing, Offer, Closed, each with its count. Cards show title, company, date moved, and a link to the tailored CV; Applied cards carry a success "Applied" badge. Drag and drop between columns, with a DropdownMenu "Move to" on every card for keyboard users. Columns are 272 px; when they do not fit, the board scrolls sideways with snap points and a note ("Scroll sideways to see all five columns."). Under 768 px the columns stack.

### 5.7 Companies
Table: name, website, ATS (or "careers site"), open roles, last checked, discovered via, flags (staffing agency, paused, muted). Row actions in a DropdownMenu: mute, confirm ATS match, remove (with an AlertDialog). "Add a company" Dialog: paste a careers or website URL, show detection result live ("Found a Greenhouse board with 23 open roles"), then "Track this company".

### 5.8 Profile
A Card per section: basics, experience, projects, education, skills, certifications. Every item shows small source badges (CV, LinkedIn, GitHub, portfolio, added by you); a bullet shows its own badges only when they differ from its item's. Editing uses Field components with react-hook-form and zod. Bullets reorder by drag or with Move up / Move down. Removing anything shows an Undo toast. Version history in a Sheet with restore. Conflicts Alert at the top until resolved.

### 5.9 Settings
Cards with forms: Account (the signed-in email and a "Sign out" outline button), Search preferences, CV defaults, AI provider (with the privacy note in a calm Alert: "On Gemini's free tier, Google can use what you send to improve its products. Use a paid key or another provider if you would rather it did not."), Sources (Switch per tier, keys shown as set or not set, never the key), Theme (System, Light, Dark), Data (export, delete all behind an AlertDialog). Controls: Switch, Select, RadioGroup.

## 6. Components

shadcn/ui components, added with the official CLI (`pnpm dlx shadcn@latest add <name>`) into `src/components/ui`:

Sidebar, Breadcrumb, DropdownMenu, Avatar, Separator, Tooltip, Sheet, Button, Badge, Table, Tabs, ToggleGroup, Toggle, Card, Progress, Textarea, Skeleton, Alert, Sonner, Command, Dialog, AlertDialog, ScrollArea, Resizable, Collapsible, Kbd, Input, InputGroup, Label, Select, Switch, RadioGroup, Field, Empty, Spinner, HoverCard, Popover.

Local changes to the CLI output, kept small and commented:
- Badge: `success`, `warning`, `info` variants, and `destructive` on `--destructive-soft`.
- Alert: a `warning` variant.
- `src/hooks/use-mobile.ts`: reads the media query through `useSyncExternalStore` (the stock hook sets state in an effect, which our lint rules forbid).

App components built from them: app shell and account menu (`src/components/shell`), jobs table, job sheet and match badge (`src/components/jobs`), score card, LaTeX view, changes list and highlighted job post (`src/components/tailor`), CV sheet and preview (`src/components/cv`), page header and page states.

Forms: shadcn's `form` registry item is now empty; the current docs build forms from `Field`, `FieldLabel`, `FieldError` and friends with react-hook-form's `Controller` and a zod resolver. Use that.

Icons: lucide-react only, at the component defaults (16 px in buttons and menus).

## 7. States checklist (every screen)

- Loading: skeletons that match the final layout. No layout shift when data arrives.
- Empty: one sentence on what is happening plus the next action.
- Error: what happened and what to do, with a retry. Errors do not apologize. Example: "Gemini's rate limit was reached. Your CV will finish tailoring in about a minute, or you can try again now."
- Partial: show what loaded and label what did not ("Not listed", "Not scored yet").
- Offline: keep showing cached feed with a quiet banner.

## 8. Accessibility

- WCAG 2.2 AA. Visible focus: shadcn's focus ring in `--ring`, which is the info blue.
- Full keyboard paths for every action, including drag and drop alternatives.
- Live regions for tailoring progress and toasts.
- Highlights in the job post are `<mark>` elements with accessible labels ("matched keyword", "missing keyword").
- Touch targets at least 44 px on mobile for primary actions; nothing tappable under 24 px.
- Sortable table headers set `aria-sort`.

## 9. Writing

- Write for Pratik, in plain words. Name things by what they do for him ("Tailor my CV", "Open in Overleaf", "Run search now"), not by system internals ("Trigger pipeline").
- Sentence case. Active voice. No em dashes. No filler.
- Buttons say exactly what happens, and the result uses the same verb: "Save" leads to "Saved", "Dismiss" leads to "Dismissed. Undo".
- No arrows appended to button or link text.
- Numbers: "2 days ago", "$95k to $130k" in a "Pay per year" column, "approx. $64k".
- Plain labels: "88, Strong match", "You're missing", "Where", "Pay", "Source", "Why it fits".
- Never say "AI-powered" or "magic" in the UI.

## 10. Quality bar

The goal is a clean, familiar app that looks like it was made with care. A screen is not done until it passes all of this.

### 10.1 Use the system
- shadcn/ui components and their stock look. Do not restyle primitives to a custom brand; do not hand-build what a shadcn component already does.
- Geist Sans, Geist Mono for numbers, Lucide icons. No second icon set.
- Neutral everywhere; the four status colors only for their meanings.

### 10.2 Avoid
- Decoration: gradients, gradient text, glows, glassmorphism, blurred blobs, noise textures, colored accents without a meaning.
- Purple, violet or blue-to-purple "AI" accents. Sparkle, magic wand, robot or brain icons. Emoji in the UI.
- Dashboard stat tiles at the top of pages. Numbers appear only where they help a decision, next to what they describe.
- An icon next to every heading. Icons where they speed up scanning: the sidebar, buttons, menu items, empty states.
- More than one primary button in a view. Everything shown at once when it could open on demand.
- Cramped layouts: small text, tight rows, edge-to-edge content on desktop.
- Marketing copy inside the app ("Supercharge", "unlock", "elevate", "seamless", "effortless", "AI-powered", "magic", "your journey", "Let's get started!", exclamation marks). The app talks like a precise colleague.
- Placeholder text like "Lorem ipsum" or "John Doe" in anything shown to Sam or Pratik. Use realistic fictional data (Nadia Chowdhury).

### 10.3 Style tile
`/design` (dev only; `ENABLE_DESIGN_TILE=1` shows it in a production build) shows the theme in both modes, the status colors and badges, type, every component in use, and the screen states. Update it when components change. The dev-only routes `/preview/today` and `/preview/tailor` show those screens with fictional data inside the real shell (`?state=` for loading, empty, error, late, paste and working).

### 10.4 Side-by-side check
Put the screenshot next to the official shadcn example of a similar screen (dashboard, tasks table, settings, sidebar). It should look like it belongs to the same family, and be at least as clear and roomy.

## 11. Review loop

For every UI task: build, run, screenshot at 1440 and 390 px in light and dark (add 1024 px for the tailor workspace and tables), check sections 3 to 10 one by one, fix, and only then mark done. Show Sam screenshots before moving on from a new screen. Before the end of each phase, do one pass that removes one unnecessary element per screen.
