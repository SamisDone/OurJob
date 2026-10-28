# ATS scoring and keyword matching

There is no universal ATS score. Real systems (Workday, Greenhouse, Lever and others) each parse and rank differently, and none publish a standard score. Ours is an **estimate** built from measurable signals that matter across systems: keyword coverage, keyword placement, title alignment and parseability. It must be deterministic and explainable. The UI always labels it "Estimated ATS match".

## 1. Inputs

- `JobSpec` (from P2) with keywords, importance, synonyms.
- CV text, either the master CV (rendered from the full master profile) or the tailored CV (rendered from `TailoredResume`), split into sections: headline, summary, skills, experience bullets, project bullets, education, other.

## 2. Keyword matcher

`matchKeyword(keyword, cvSections) -> { found: boolean; locations: SectionName[]; matchedForm: string }`

Rules:
1. Normalize both sides: lowercase, Unicode NFKC, collapse whitespace, unify `-`/`_`/`.` variants (for example "Node.js", "NodeJS", "node js" all match "node.js").
2. Match the term, its canonical name, and its synonyms (from JobSpec plus `data/skill-synonyms.json`).
3. Word boundaries always. "Java" must not match "JavaScript". "React" must not match "Reactive".
4. **Ambiguous short terms** (`Go`, `C`, `R`, `C#`, `C++`, `.NET`, `Rust`, `Swift`, `Dart`, `Elm`, `Ruby`): match case-sensitively and require tech context: either inside the skills section, or within 6 words of another known tech term, or as `Golang` / `Go (Golang)`. Unit-test "go to market" and "Go microservices".
5. Simple plural and verb forms: "API" matches "APIs"; "test" does not match "testing" unless listed as a synonym.
6. Multi-word terms: match the full phrase, words in order, with nothing between them except whitespace or a hyphen ("continuous integration", "continuous-integration"). Compounds written with a slash also match their "and" form ("CI/CD" matches "CI and CD").

The same matcher decides `matched` vs `gaps` before tailoring (matching JobSpec against the master profile's skills, aliases and bullet text) and computes coverage after.

## 3. Score formula (0 to 100)

| Component | Weight | How |
|---|---|---|
| Must-have coverage | 45 | (must-have keywords found / must-have keywords) x 45 |
| Nice-to-have coverage | 15 | (nice keywords found / nice keywords) x 15; if the JD has none, redistribute to must-have |
| Keyword placement | 10 | Share of found hard skills that appear in experience or project bullets, not only in the skills list |
| Title alignment | 10 | 10 if the job title or its close variant is in the headline; 6 if the core noun ("engineer", "developer") and main qualifier ("frontend") appear in headline or summary; else 0 |
| Seniority and years | 5 | 5 if role seniority matches his experience span; 2 if one level off; 0 otherwise or unknown (unknown counts as 2.5) |
| Parseability | 15 | Checks below, each worth an equal share |

Parseability checks (all deterministic):
- Standard section headings present ("Experience", "Education", "Skills", "Projects").
- Contact info present: email and at least one link.
- Dates in a consistent format on every role.
- Single column body, no images, no icons (always true for our template, but keep the check so imported CVs can be scored). Our template uses `tabular*` only to put dates on the right of one-line headings; that is fine and passes. Multi-column body layouts fail.
- Length within target (1 or 2 pages estimated).
- No text in headers or footers (template guarantees).
- File text is extractable (template uses `\pdfgentounicode=1`).

Round to the nearest integer. Show each component's points in the breakdown.

## 4. UI output

```ts
type AtsReport = {
  score: number;
  components: { id: string; label: string; points: number; max: number; detail: string }[];
  matched: { term: string; importance: "must" | "nice"; locations: string[] }[];
  missing: { term: string; importance: "must" | "nice"; inProfile: boolean }[];
  // inProfile=true means he has it but it did not make it into this CV (fixable by re-tailoring)
  // inProfile=false is a true gap
  checks: { id: string; label: string; pass: boolean; fix?: string }[];
};
```

Show "Master CV: 54, Tailored: 86" side by side with the delta.

## 5. Feed ranking (separate from ATS score)

`feedScore = 0.6 * llmFit + 0.15 * payScore + 0.1 * freshness + 0.1 * lesserKnownBoost + 0.05 * sourceTierScore`

- `llmFit`: P4 fitScore (0 to 100). If not scored yet, use prefilter score scaled to 0 to 100 and show "Not scored yet".
- `payScore`: 100 if annual USD max is at or above 1.5x his minimum, scaled linearly down to 0 at his minimum; 50 if pay not listed (neutral); 0 if below his minimum (and hidden if he set "hide below minimum").
- `freshness`: 100 for posted today, minus 14 per day.
- `lesserKnownBoost`: 100 if company is not well known (JOB_SOURCES section 6) and the "prefer lesser-known" toggle is on; else 0.
- `sourceTierScore`: tier 1 = 100, tier 2 = 60, tier 3 = 40.

Weights live in one config file so Sam can tune them.

## 6. Tests (must exist)

- "Java" vs "JavaScript", "React" vs "React Native" vs "Reactive".
- "Go" in "go to market" (no match) vs "Go, Python" in skills (match) vs "Golang" (match).
- "C++" and "C#" tokenization.
- "Node.js" variants.
- "CI/CD" and "CI and CD".
- "Postgres" synonym for "PostgreSQL".
- Score determinism: same inputs, same score, 100 runs.
- Redistribution when no nice-to-haves.
