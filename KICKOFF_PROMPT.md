# Kickoff prompt for Claude Code

Copy everything inside the box below into Claude Code as your first message, from inside the new repo folder that contains these files.

---

```
You are building OurJob, an open-source job search app for my partner Pratik, a software engineer. I am Sam, the builder and owner of this repo.

Read these files fully before doing anything else, in this order:
1. CLAUDE.md
2. docs/PRD.md
3. docs/ARCHITECTURE.md
4. docs/JOB_SOURCES.md
5. docs/AI_PROMPTS.md
6. docs/ATS_SCORING.md
7. docs/DESIGN.md
8. docs/BUILD_PLAN.md
9. templates/resume-sample.tex

Then start building Phase 0 right away. Do not wait for my confirmation. Use the decided defaults in CLAUDE.md. If something in the docs is contradictory or unclear, make the reasonable call, log it in DECISIONS.md, and mention it in your phase summary.

Build the /design style tile first in Phase 0. When it is ready, show it to me (screenshots in light and dark, desktop and mobile) and keep working on the non-UI parts of Phase 0 while I review it with Pratik. Do not build real screens until I approve the style tile.

When you need an account or key I have not given you yet, tell me exactly what to create and where to paste it, and carry on with other work.

Important rules, repeated from CLAUDE.md because they matter most:
- Never add Claude or any AI as a co-author. No Co-Authored-By trailer, no "Generated with Claude Code" line, no AI attribution in commits, PRs, code or README.
- Never invent facts about Pratik in a CV. The validator enforces this in code.
- Verify every external API, SDK and library against current official docs and one real response before coding to it. Your memory of APIs may be out of date.
- Pratik dislikes generic AI-looking design. DESIGN.md section 10 is a hard gate.
- No secrets and no real personal data in the repo.
- No em dashes in UI copy or generated CV text.
```

---

## Prompts for later phases

When a phase is done and you have reviewed it, start the next one with:

```
Phase N is approved. Re-read CLAUDE.md and the docs relevant to Phase N+1, then post your plan for Phase N+1 and start building. Log decisions in DECISIONS.md. Stop and summarize when the Phase N+1 done criteria in docs/BUILD_PLAN.md are met.
```

For a design review round:

```
Take screenshots of [screen] at 1440, 1024 and 390 px in light and dark. Check each against docs/DESIGN.md sections 3 to 10 and list every place it falls short, especially anything in section 10.1. Then fix them and show me the new screenshots.
```

For a CV quality check:

```
Run pnpm eval:prompts and show me the results table. Then tailor the fictional CV in tests/fixtures/cvs/ to the 3 JDs in tests/fixtures/jds/ I just added, and show me the validator reports and the ATS breakdowns.
```
