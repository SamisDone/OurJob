# Setup checklist for Sam

Things only you can do. Claude Code will ask for these as it needs them; having them ready saves time. All free for one user, as reported in October 2026 (check each provider's current pricing page).

## Before Phase 0

- [ ] Create an empty GitHub repo (public if you want free GitHub Actions minutes for the daily job; check GitHub's current terms).
- [ ] Put the contents of this folder at the repo root and commit.
- [ ] Pick a license (MIT or AGPL-3.0). The name is OurJob; check GitHub and the web for clashes.
- [ ] Install Node.js (current LTS), pnpm, and Claude Code.

## Phase 0

- [ ] **Database:** create a free Postgres database on Neon (or Supabase). Copy the connection string into `.env.local` as `DATABASE_URL`.
- [ ] **Google sign-in:** in Google Cloud Console, create an OAuth client (Web). Add `http://localhost:3000` and your production URL as authorized origins, and the Auth.js callback URLs Claude Code gives you as redirect URIs. Copy the client ID and secret.
- [ ] Generate `AUTH_SECRET` (Claude Code will tell you the command).
- [ ] Add Pratik's and your Google emails to `ALLOWED_EMAILS`.

## Phase 1

- [ ] **Gemini API key:** create one in Google AI Studio. Read the privacy note in Settings; on the free tier Google may use submitted content to improve its products.
- [ ] Optional **GitHub token** (fine-grained, public repo read only) to raise GitHub API limits during profile import.
- [ ] Get Pratik's real CV (his `.tex` from Overleaf is the best input), LinkedIn "Save to PDF" export, GitHub username and portfolio URL ready. Keep them out of the repo; upload them through the app.
- [ ] For local prompt evals with his real CV, put a copy in `tests/private/` (git-ignored). Check `git status` shows nothing from that folder before every commit.

## Phase 3

- [ ] Optional **Adzuna** key: register at developer.adzuna.com.
- [ ] Optional **JSearch** key: OpenWeb Ninja or RapidAPI free plan.
- [ ] Add GitHub Actions secrets: `DATABASE_URL`, `GEMINI_API_KEY`, `LLM_MODEL`, and the optional source keys.
- [ ] Optional: a fine-grained `GITHUB_DISPATCH_TOKEN` (Actions read and write, this repo only) for the "Run now" button.

## Deploy

- [ ] Import the repo into Vercel (Hobby). Add all env vars. Update Google OAuth with the production URL.
- [ ] Open the app, sign in, and run onboarding with Pratik's files.

## Review moments (Claude Code will stop and ask)

- [ ] Phase 0: approve the `/design` style tile with Pratik. Be picky; this sets the look of everything.
- [ ] Phase 2: open 3 tailored CVs in Overleaf and check them line by line against his real CV.
- [ ] Phase 3: spot-check 30 feed jobs for freshness, duplicates and remote eligibility.
