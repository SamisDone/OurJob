# OurJob

A self-hostable job search workspace for one person. It keeps a master profile built from your CV, LinkedIn export, GitHub and portfolio; tailors your CV to a job description and gives you LaTeX to open in Overleaf; shows an explainable, estimated ATS match; and every morning lists fresh remote jobs from companies' own career pages and remote job boards.

Status: early development (Phase 0 of [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md)). Not ready to self-host yet.

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
```

A full self-host guide (accounts, env vars, GitHub secrets, deploy) comes in Phase 5.

## Docs

Product and engineering docs live in [docs/](docs/). Decisions and their reasons are in [DECISIONS.md](DECISIONS.md).

## License

MIT. The CV template is based on Jake Gutierrez's resume template (MIT). The CV preview uses Latin Modern Roman under the GUST Font License (see `src/fonts/latin-modern/`).
