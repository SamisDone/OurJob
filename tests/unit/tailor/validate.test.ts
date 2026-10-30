import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CacheStore } from "@/lib/llm/cache";
import { p1OutputSchema } from "@/lib/llm/prompts/p1-profile";
import type { GenerateArgs, LLMProvider } from "@/lib/llm/types";
import { normalizeProfile } from "@/lib/profile/normalize";
import type { TailoredResume } from "@/lib/profile/schema";
import type { GapKeyword, MatchedKeyword } from "@/lib/tailor/keywords";
import { splitKeywords } from "@/lib/tailor/keywords";
import { tailorCv } from "@/lib/tailor/pipeline";
import { validateTailored, type Issue } from "@/lib/tailor/validate";

const profile = normalizeProfile(
  p1OutputSchema.parse(JSON.parse(readFileSync("tests/fixtures/llm/p1-profile/nadia-chowdhury.json", "utf8")).output),
);

const matched: MatchedKeyword[] = [
  { term: "Kafka", canonical: "Kafka", importance: "must", proofIds: ["b_1_2", "sk_kafka"] },
  { term: "Postgres", canonical: "PostgreSQL", importance: "must", proofIds: ["sk_postgresql"] },
  { term: "Go", canonical: "Go", importance: "must", proofIds: ["b_1_1", "sk_go"] },
];
const gaps: GapKeyword[] = [
  { term: "OpenTelemetry", canonical: "OpenTelemetry", synonyms: ["OTel"], importance: "nice" },
];
// Single checks are tested on the model's text; restoring original wording is tested on its own.
const ctx = { profile, matched, gaps, pages: 1 as const, restoreOriginals: false };

const good = (): TailoredResume => ({
  headline: "Backend Engineer",
  summary: {
    text: "Backend Engineer with 5+ years of experience designing Go and Python services, PostgreSQL schemas and event pipelines for logistics and payments products.",
    sourceIds: ["summary"],
  },
  sections: ["summary", "skills", "experience", "projects", "education"],
  skills: [
    {
      group: "Languages",
      items: [
        { name: "Go", skillId: "sk_go" },
        { name: "Python", skillId: "sk_python" },
      ],
    },
    {
      group: "Data",
      items: [
        { name: "PostgreSQL", skillId: "sk_postgresql" },
        { name: "Kafka", skillId: "sk_kafka" },
      ],
    },
  ],
  experience: [
    {
      experienceId: "exp_1",
      bullets: [
        {
          text: "Designed the rate-quote service in Go that answers about 1,200 requests per second at p99 under 80 ms.",
          boldPhrases: ["rate-quote service"],
          sourceIds: ["b_1_1"],
          keywordsUsed: ["Go"],
        },
        {
          text: "Moved nightly billing jobs to a Kafka-based event pipeline that cut failed invoice runs by roughly 60%.",
          boldPhrases: ["Kafka", "60%"],
          sourceIds: ["b_1_2"],
          keywordsUsed: ["Kafka"],
        },
      ],
      tech: ["Go", "PostgreSQL", "Kafka"],
    },
    {
      experienceId: "exp_2",
      bullets: [
        {
          text: "Built the merchant settlement API in Python (Django) used by 2,000+ merchants.",
          boldPhrases: ["2,000+ merchants"],
          sourceIds: ["b_2_1"],
          keywordsUsed: [],
        },
      ],
      tech: ["Python", "Django"],
    },
  ],
  projects: [
    {
      projectId: "proj_1",
      bullets: [
        {
          text: "Small CLI that samples pg_stat_statements and flags slow queries in CI.",
          boldPhrases: [],
          sourceIds: ["b_p1_1"],
          keywordsUsed: [],
        },
      ],
      tech: ["Go", "PostgreSQL"],
    },
  ],
  educationIds: ["edu_1"],
  certificationIds: [],
  awardIds: [],
  // The fixture CV keeps it short; check 9 accepts left-out role bullets that the notes explain.
  notes: [
    "Left out b_1_3: mentoring is not part of this job.",
    "Left out b_2_2: reconciliation is covered by the settlement bullet.",
    "Left out b_2_3: row-level security is not part of this job.",
  ],
});

const run = (edit: (r: TailoredResume) => void) => {
  const r = good();
  edit(r);
  return validateTailored(r, ctx);
};
const of = (issues: Issue[], check: Issue["check"], action?: Issue["action"]) =>
  issues.filter((i) => i.check === check && (!action || i.action === action));

describe("validator", () => {
  it("sends an unexplained left-out role bullet back to the fix loop, and reports an explained one", () => {
    const silent = run((r) => (r.notes = r.notes.filter((n) => !n.includes("b_1_3"))));
    expect(of(silent.issues, "kept", "fix").map((i) => i.message)).toEqual([
      expect.stringContaining("Keep b_1_3 from Parcelwise"),
    ]);
    const explained = run(() => {});
    expect(of(explained.issues, "kept", "fix")).toEqual([]);
    expect(of(explained.issues, "kept", "report")).toHaveLength(3);
    const generic = run(
      (r) => (r.notes = r.notes.map((n) => (n.includes("b_1_3") ? "Left out b_1_3: irrelevant to this job." : n))),
    );
    expect(of(generic.issues, "kept", "fix")).toHaveLength(1);
  });

  it("passes a CV that only uses profile facts", () => {
    const { issues } = validateTailored(good(), ctx);
    // Only the left-out role bullets the notes explain are reported.
    expect(issues.filter((i) => i.action !== "fixed" && i.check !== "kept")).toEqual([]);
    expect(issues.filter((i) => i.check === "kept").every((i) => i.action === "report")).toBe(true);
  });

  it("1. drops unknown roles and source ids", () => {
    const { resume, issues } = run((r) => {
      r.experience.push({ experienceId: "exp_9", bullets: [], tech: [] });
      r.experience[0].bullets[0].sourceIds.push("b_9_9");
    });
    expect(resume.experience.map((e) => e.experienceId)).toEqual(["exp_1", "exp_2"]);
    expect(resume.experience[0].bullets[0].sourceIds).toEqual(["b_1_1"]);
    expect(of(issues, "ids", "fixed")).toHaveLength(2);
  });

  it("2. sends a bullet with no real source to the fix loop", () => {
    const { issues } = run((r) => (r.experience[1].bullets[0].sourceIds = ["b_7_7"]));
    expect(of(issues, "source", "fix")[0].ref).toBe("experience:exp_2:0");
  });

  it("3. catches numbers that are not in the source, stronger claims and dropped hedges", () => {
    const { issues } = run((r) => {
      r.experience[1].bullets[0].text = "Built the merchant settlement API used by 3,000 merchants.";
      r.experience[0].bullets[1].text = "Moved nightly billing jobs to Kafka and cut failed invoice runs by 60%.";
    });
    expect(of(issues, "numbers", "fix").map((i) => i.ref)).toEqual(["experience:exp_1:1", "experience:exp_2:0"]);
    expect(of(issues, "numbers")[0].message).toMatch(/hedge/);
  });

  it("3b. removes bold phrases not in the text and tech the role does not list", () => {
    const { resume, issues } = run((r) => {
      r.experience[0].bullets[0].boldPhrases.push("billing platform");
      r.experience[1].tech.push("Kubernetes");
    });
    expect(resume.experience[0].bullets[0].boldPhrases).toEqual(["rate-quote service"]);
    // Kubernetes goes; the tech line is never trimmed, so the role's own tools all stay.
    expect(resume.experience[1].tech).toEqual(profile.experience[1].tech);
    expect(of(issues, "bold", "fixed")).toHaveLength(1);
    expect(of(issues, "tech", "fixed").map((i) => i.message)).toEqual(
      expect.arrayContaining([expect.stringMatching(/Removed "Kubernetes"/), expect.stringMatching(/Put back/)]),
    );
  });

  it("4. removes skills that are not in the profile and flags skill names added to bullets", () => {
    const { resume, issues } = run((r) => {
      r.skills[0].items.push({ name: "Java", skillId: "sk_java" });
      r.experience[1].bullets[0].text =
        "Built the merchant settlement API in Java and Python used by 2,000+ merchants.";
    });
    expect(resume.skills[0].items.map((i) => i.name)).toEqual(["Go", "Python"]);
    expect(of(issues, "skills", "fix")[0]).toMatchObject({
      ref: "experience:exp_2:0",
      message: expect.stringMatching(/Java/),
    });
  });

  it("5. never lets a gap keyword through", () => {
    const { resume, issues } = run((r) => {
      r.experience[0].bullets[0].text += " Traced with OpenTelemetry.";
      r.skills[1].items.push({ name: "OTel", skillId: "sk_postgresql" });
      r.headline = "OpenTelemetry Engineer";
    });
    expect(of(issues, "gap", "fix").map((i) => i.ref)).toEqual(["experience:exp_1:0"]);
    expect(resume.headline).toBe("Backend Engineer");
    expect(JSON.stringify(resume.skills)).not.toMatch(/OTel/);
  });

  it("6. reports matched keywords the CV leaves out", () => {
    const { issues } = run((r) => {
      // Tech lines are never trimmed, so only leaving out the role that shows Kafka loses it.
      r.experience.splice(0, 1);
      r.skills[1].items = [{ name: "PostgreSQL", skillId: "sk_postgresql" }];
    });
    expect(of(issues, "coverage", "fix").map((i) => i.message)).toEqual([expect.stringMatching(/^Kafka is missing/)]);
  });

  it("2c. puts his original bullet back when a rewrite drops the job's words or adds a detail", () => {
    const { resume, issues } = validateTailored(
      (() => {
        const r = good();
        r.experience[1].bullets[0].text = "Built the settlement API used by 2,000+ merchants on PostgreSQL.";
        return r;
      })(),
      { ...ctx, restoreOriginals: true, jobText: "We use Python and Django for merchant APIs." },
    );
    expect(resume.experience[1].bullets[0].text).toBe(profile.experience[1].bullets[0].text);
    const fid = of(issues, "fidelity", "fixed")[0];
    expect(fid.message).toMatch(/dropped .*Django/);
    expect(fid.message).toMatch(/added "PostgreSQL"/);
    expect(of(issues, "numbers", "fix")).toEqual([]);
  });

  it("3c. keeps each tool once on a tech line", () => {
    const { resume } = run((r) => {
      r.experience[1].tech = ["PostgreSQL", "Python", "PostgreSQL", "postgresql"];
    });
    const tech = resume.experience[1].tech;
    expect(tech.filter((x) => x === "PostgreSQL")).toHaveLength(1);
    expect(new Set(tech).size).toBe(tech.length);
  });

  it("4c. moves languages out of Backend or Data into Languages", () => {
    const { resume, issues } = run((r) => {
      r.skills = [
        {
          group: "Backend",
          items: [
            { name: "Go", skillId: "sk_go" },
            { name: "Kafka", skillId: "sk_kafka" },
          ],
        },
        {
          group: "Data",
          items: [
            { name: "Python", skillId: "sk_python" },
            { name: "PostgreSQL", skillId: "sk_postgresql" },
          ],
        },
      ];
    });
    expect(resume.skills.map((g) => [g.group, g.items.map((i) => i.name)])).toEqual([
      ["Languages", ["Go", "Python"]],
      ["Backend", ["Kafka"]],
      ["Data", ["PostgreSQL"]],
    ]);
    expect(of(issues, "group", "fixed")).toHaveLength(2);
  });

  it("7. replaces em dashes and flags words to avoid", () => {
    const { resume, issues } = run((r) => {
      r.summary!.text = r.summary!.text.replace(" designing", " — designing");
      r.experience[1].bullets[0].text = "Leveraged Python (Django) for the settlement API used by 2,000+ merchants.";
    });
    expect(resume.summary!.text).not.toMatch(/—/);
    expect(of(issues, "style", "fixed")).toHaveLength(1);
    expect(of(issues, "style", "fix")[0].ref).toBe("experience:exp_2:0");
  });

  it("6 (rules). keeps roles in order and asks for the most recent role", () => {
    const reordered = run((r) => r.experience.reverse());
    expect(reordered.resume.experience.map((e) => e.experienceId)).toEqual(["exp_1", "exp_2"]);
    const missing = run((r) => r.experience.shift());
    expect(of(missing.issues, "order", "fix")[0].message).toMatch(/most recent role/);
  });

  it("8. asks to trim a CV that will not fit the page", () => {
    const { issues } = run((r) => {
      const b = r.experience[0].bullets[0];
      r.experience[0].bullets = Array.from({ length: 40 }, () => ({ ...b }));
    });
    expect(of(issues, "length", "fix")).toHaveLength(1);
  });
});

describe("tailoring pipeline with a scripted model", () => {
  const jd = `Senior Backend Engineer at Lumen Labs. ${"We build scheduling software for clinics. ".repeat(4)}
Requirements: production Go, Kafka and Postgres. Nice to have: OpenTelemetry.`;

  function scripted(answers: Record<string, unknown[]>): LLMProvider {
    return {
      name: "scripted",
      model: "test",
      async generateJSON<T>(args: GenerateArgs<T>) {
        const next = answers[args.promptId]?.shift();
        if (next === undefined) throw new Error(`no scripted answer for ${args.promptId}`);
        return { data: args.schema.parse(next), usage: { inputTokens: 0, outputTokens: 0 } };
      },
    };
  }
  const memory = (): CacheStore => {
    const m = new Map<string, unknown>();
    return { get: async (k) => m.get(k), set: async (k, v) => void m.set(k, v) };
  };
  const spec = {
    title: "Senior Backend Engineer",
    company: "Lumen Labs",
    responsibilities: [],
    keywords: [
      {
        term: "Senior Backend Engineer",
        canonical: "Senior Backend Engineer",
        synonyms: [],
        importance: "must",
        kind: "title",
        evidenceQuote: "Senior Backend Engineer",
      },
      {
        term: "Go",
        canonical: "Go",
        synonyms: ["Golang"],
        importance: "must",
        kind: "hard_skill",
        evidenceQuote: "production Go",
      },
      {
        term: "Kafka",
        canonical: "Kafka",
        synonyms: [],
        importance: "must",
        kind: "tool",
        evidenceQuote: "Go, Kafka and Postgres",
      },
      {
        term: "Postgres",
        canonical: "PostgreSQL",
        synonyms: [],
        importance: "must",
        kind: "hard_skill",
        evidenceQuote: "Kafka and Postgres",
      },
      {
        term: "OpenTelemetry",
        canonical: "OpenTelemetry",
        synonyms: [],
        importance: "nice",
        kind: "tool",
        evidenceQuote: "Nice to have: OpenTelemetry",
      },
      {
        term: "Rust",
        canonical: "Rust",
        synonyms: [],
        importance: "nice",
        kind: "hard_skill",
        evidenceQuote: "Rust is a plus",
      },
    ],
  };

  it("splits keywords into matched with proof and gaps, and drops quotes that are not in the post", async () => {
    // Two sources: code cannot put one original back, so the fix loop rewrites it.
    const bad = good();
    bad.experience[1].bullets[0].text = "Built the merchant settlement API used by 3,000 merchants.";
    bad.experience[1].bullets[0].sourceIds = ["b_2_1", "b_2_2"];
    const fixed = good().experience[1].bullets[0];
    const res = await tailorCv(jd, profile, {
      provider: scripted({
        "p2-job": [spec],
        "p3-tailor": [bad],
        "p3-fix": [{ changes: [{ ref: "experience:exp_2:0", action: "replace", bullet: fixed }] }],
      }),
      cache: memory(),
    });
    expect(res.droppedKeywords.map((d) => d.term)).toEqual(["Rust"]);
    expect(res.matched.map((m) => m.term)).toEqual(["Go", "Kafka", "Postgres"]);
    expect(res.gaps.map((g) => g.term)).toEqual(["OpenTelemetry"]);
    expect(of(res.firstIssues, "numbers", "fix")).toHaveLength(1);
    expect(res.fixRounds).toBe(1);
    expect(res.finalIssues.filter((i) => i.action === "fix")).toEqual([]);
    expect(res.removed).toEqual([]);
  });

  it("reads the job post with the job model and writes with the chosen one", async () => {
    // Each scripted model throws on a prompt it has no answer for.
    const res = await tailorCv(jd, profile, {
      provider: scripted({ "p3-tailor": [good()] }),
      jobProvider: scripted({ "p2-job": [spec] }),
      cache: memory(),
    });
    expect(res.matched.map((m) => m.term)).toEqual(["Go", "Kafka", "Postgres"]);
  });

  it("removes what still fails after two rounds and says why", async () => {
    const bad = good();
    bad.experience[1].bullets[0].text = "Built the merchant settlement API used by 3,000 merchants.";
    bad.experience[1].bullets[0].sourceIds = ["b_2_1", "b_2_2"];
    const stillBad = { ...bad.experience[1].bullets[0], text: "Built the settlement API used by 4,000 merchants." };
    const res = await tailorCv(jd, profile, {
      provider: scripted({
        "p2-job": [spec],
        "p3-tailor": [bad],
        "p3-fix": [
          { changes: [{ ref: "experience:exp_2:0", action: "replace", bullet: stillBad }] },
          { changes: [{ ref: "experience:exp_2:0", action: "replace", bullet: stillBad }] },
        ],
      }),
      cache: memory(),
    });
    expect(res.fixRounds).toBe(2);
    expect(res.removed).toEqual([
      {
        ref: "experience:exp_2:0",
        text: stillBad.text,
        reasons: expect.arrayContaining(['"4,000" is not in its source items.']),
      },
    ]);
    expect(res.resume.experience.find((e) => e.experienceId === "exp_2")?.bullets).toEqual([]);
    expect(res.finalIssues.filter((i) => i.action === "fix")).toEqual([]);
  });

  it("finds Go in the profile only as the language", () => {
    const { matched } = splitKeywords(
      { ...spec, keywords: spec.keywords.filter((k) => k.term === "Go") } as never,
      profile,
    );
    expect(matched[0].proofIds).toContain("sk_go");
  });
});
