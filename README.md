# OurJob

A self-hostable job search workspace for one person. It keeps a master profile built from your CV, LinkedIn export, GitHub and portfolio; tailors your CV to a job description and gives you LaTeX to open in Overleaf; shows an explainable, estimated ATS match; and every morning lists fresh remote jobs from companies' own career pages and remote job boards.

Status: early development (Phase 2 of [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md)). Not ready to self-host yet.

## Run it locally

Requirements: Node.js 22 or newer, pnpm 10, Docker (for a local Postgres).

```sh
pnpm install
docker run -d --name ourjob-pg -e POSTGRES_USER=ourjob -e POSTGRES_PASSWORD=ourjob -e POSTGRES_DB=ourjob -p 5433:5432 postgres:17-alpine
cp .env.example .env.local      # then fill in DATABASE_URL, AUTH_SECRET, Google OAuth and ALLOWED_EMAILS
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000/design for the style tile, or http://localhost:3000 to sign in.

## Commands

```sh
pnpm dev            # run the app
pnpm lint
pnpm typecheck
pnpm test           # unit tests (Vitest)
pnpm test:e2e       # Playwright, against a production build
pnpm db:generate    # Drizzle migrations from src/lib/db/schema.ts
pnpm db:migrate
pnpm db:migrate:prod   # production database, see Deploy
```

A full self-host guide (accounts, env vars, GitHub secrets, deploy) comes in Phase 5.

## Deploy (Vercel Hobby + Neon)

The app runs on Vercel with its functions in Singapore (`vercel.json` sets `sin1`), next to a Neon Postgres database in the same region. Do the steps in this order.

1. **Neon.** Create a project in the region *AWS Asia Pacific (Singapore)*. From *Connect*, copy two connection strings: the **pooled** one (connection pooling on, the host contains `-pooler`) for the app, and the **direct** one (pooling off) for migrations.
2. **Migrate.** On your machine, create `.env.production.local` (git-ignored) with one line, `DATABASE_URL_UNPOOLED=<the direct string>`, then run `pnpm db:migrate:prod`. It reads only that file and refuses a local database. Run it again before deploying any commit that adds a file to `drizzle/`.
3. **Secret.** Generate a new `AUTH_SECRET` for production (`npx auth secret` or `openssl rand -base64 32`). Do not reuse the local one.
4. **Vercel.** Import the GitHub repository (framework and pnpm are detected). Before the first deploy, add these environment variables for the **Production** environment only:

   | Variable | Value | Needed |
   |---|---|---|
   | `DATABASE_URL` | Neon **pooled** string | now |
   | `AUTH_SECRET` | from step 3 | now |
   | `AUTH_GOOGLE_ID` | Google OAuth client ID | now |
   | `AUTH_GOOGLE_SECRET` | Google OAuth client secret | now |
   | `ALLOWED_EMAILS` | comma-separated Google emails allowed to sign in | now |
   | `GEMINI_API_KEY` | from Google AI Studio | now |
   | `LLM_PROVIDER` | `gemini` | now |
   | `LLM_MODEL` | `gemini-3.5-flash-lite` | now |
   | `LLM_FALLBACK_MODEL` | `gemini-3.8-flash` | now |
   | `LLM_THOROUGH_MODEL` | `gemini-3.8-flash`, offered in Settings for tailoring | optional |
   | `LLM_RPM` | requests per minute, default 8 | optional |
   | `GITHUB_TOKEN` | a token with no scopes, raises GitHub's limits for profile import | optional |

   Leave out `ENABLE_DESIGN_TILE` (so `/design` stays a 404), `AUTH_URL` and `AUTH_TRUST_HOST` (Auth.js reads the host from Vercel's headers). The job pipeline variables in `.env.example` are not needed until the daily search exists. Then deploy.
5. **Google OAuth.** In Google Cloud Console, open the OAuth client (type *Web application*) and add, with your Vercel address:
   - Authorized JavaScript origin: `https://<your-app>.vercel.app`
   - Authorized redirect URI: `https://<your-app>.vercel.app/api/auth/callback/google`

   The same client can keep its localhost entries. If the consent screen is in *Testing*, add every allowed email as a test user.
6. **Check.** Open the address, sign in with an allowed email, and confirm that `/design` returns 404.

Sign-in works only on the production address: preview deployments get a different host each time, which Google does not know.

## Docs

Product and engineering docs live in [docs/](docs/). Decisions and their reasons are in [DECISIONS.md](DECISIONS.md).

## License

MIT. The CV template is based on Jake Gutierrez's resume template (MIT). The CV preview uses Latin Modern Roman under the GUST Font License (see `src/fonts/latin-modern/`).
