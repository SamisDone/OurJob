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
import { droppedDetails } from "@/lib/tailor/fidelity";
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
  it("puts an unexplained left-out role bullet back in his words, and reports an explained one", () => {
    const silent = run((r) => (r.notes = r.notes.filter((n) => !n.includes("b_1_3"))));
    expect(of(silent.issues, "kept", "fixed").map((i) => i.message)).toEqual([
      expect.stringContaining("Put back b_1_3 from Parcelwise"),
    ]);
    expect(silent.resume.experience[0].bullets.at(-1)).toMatchObject({
      text: profile.experience[0].bullets[2].text,
      sourceIds: ["b_1_3"],
    });
    const explained = run(() => {});
    expect(of(explained.issues, "kept", "fix")).toEqual([]);
    expect(of(explained.issues, "kept", "report")).toHaveLength(3);
    const generic = run(
      (r) => (r.notes = r.notes.map((n) => (n.includes("b_1_3") ? "Left out b_1_3: irrelevant to this job." : n))),
    );
    expect(of(generic.issues, "kept", "fixed")).toHaveLength(1);
  });

  it("9a. uses each source bullet exactly once: removes a repeat and puts back the one it replaced", () => {
    // The real failure: two bullets from the same source, and the other source bullet gone, so the count looked right.
    const { resume, issues } = run((r) => {
      r.experience[0].bullets = [
        r.experience[0].bullets[0],
        {
          ...r.experience[0].bullets[0],
          text: `${r.experience[0].bullets[0].text.replace(/\.$/, "")} for a logistics platform.`,
        },
      ];
    });
    const used = resume.experience[0].bullets.flatMap((b) => b.sourceIds);
    expect(used.filter((id) => id === "b_1_1")).toHaveLength(1);
    expect(used).toContain("b_1_2");
    expect(of(issues, "kept", "fixed").map((i) => i.message)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Removed a repeat in Parcelwise/),
        expect.stringMatching(/Put back b_1_2/),
      ]),
    );
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
    // Skills and tech lines are never trimmed, so test with a term only the summary proves.
    const { issues } = validateTailored(
      (() => {
        const r = good();
        r.summary = undefined;
        return r;
      })(),
      {
        ...ctx,
        matched: [...matched, { term: "logistics", canonical: "logistics", importance: "nice", proofIds: ["summary"] }],
      },
    );
    expect(of(issues, "coverage", "fix").map((i) => i.message)).toEqual([
      expect.stringMatching(/^logistics is missing/),
    ]);
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
    const group = (name: string) => resume.skills.find((g) => g.items.some((i) => i.name === name))?.group;
    expect(group("Go")).toBe("Languages");
    expect(group("Python")).toBe("Languages");
    expect(group("Kafka")).toBe("Data");
    expect(group("PostgreSQL")).toBe("Data");
    expect(of(issues, "group", "fixed").length).toBeGreaterThanOrEqual(2);
  });

  it("4d. keeps every language and tool his bullets or tech lines name, job terms first, Firebase-type services under Backend", () => {
    const { resume, issues } = run((r) => {
      r.skills = [{ group: "Languages", items: [{ name: "Go", skillId: "sk_go" }] }];
    });
    const names = resume.skills.flatMap((g) => g.items.map((i) => i.name));
    // Python, PostgreSQL, Kafka, Django... are in Nadia's bullets and tech lines.
    for (const s of ["Python", "PostgreSQL", "Kafka", "Django"]) expect(names).toContain(s);
    expect(of(issues, "skills", "fixed").some((i) => /Put back/.test(i.message))).toBe(true);
    const data = resume.skills.find((g) => g.items.some((i) => i.name === "PostgreSQL"))!;
    // Job terms (Postgres, Kafka here) lead their group.
    expect(["PostgreSQL", "Kafka"]).toContain(data.items[0].name);
  });

  it("2e and 2f. flag a word said twice and job terms stacked in front of the source", () => {
    const { issues } = run((r) => {
      r.experience[0].bullets[1].text =
        "Built Postgres billing for billing: moved nightly billing jobs from cron scripts to a Kafka-based event pipeline; cut failed invoice runs by roughly 60%.";
    });
    const msgs = of(issues, "style", "fix").map((i) => i.message);
    expect(msgs.some((m) => /twice/.test(m))).toBe(true);
    expect(msgs.some((m) => /in front of the unchanged source/.test(m))).toBe(true);
  });

  it("2e. flags one job term written twice in different words", () => {
    const { issues } = run((r) => {
      r.experience[1].bullets[0].text =
        "Built the merchant settlement API in Python (Django) on Postgres and PostgreSQL used by 2,000+ merchants.";
    });
    expect(of(issues, "style", "fix").some((i) => /Postgres twice in different words/.test(i.message))).toBe(true);
  });

  it("2e. flags a bullet that adds more than one job term", () => {
    const { issues } = run((r) => {
      r.experience[0].bullets[0].text =
        "Designed the rate-quote service in Go on Postgres with Kafka that answers about 1,200 requests per second at p99 under 80 ms.";
    });
    expect(of(issues, "style", "fix").some((i) => /Adds 2 job terms/.test(i.message))).toBe(true);
  });

  it("4e. puts skills in fixed groups and order, whatever the model sent", () => {
    const { resume } = run((r) => {
      r.skills = [
        { group: "Data", items: [{ name: "PostgreSQL", skillId: "sk_postgresql" }] },
        {
          group: "Tools",
          items: [
            { name: "Python", skillId: "sk_python" },
            { name: "Django", skillId: "sk_django" },
          ],
        },
        { group: "Languages", items: [{ name: "Go", skillId: "sk_go" }] },
      ];
    });
    const groups = resume.skills.map((g) => g.group);
    const order = ["Languages", "Frontend", "Backend", "Data", "AI/ML", "Infrastructure"];
    expect(groups).toEqual(order.filter((g) => groups.includes(g)));
    expect(resume.skills[0]).toMatchObject({ group: "Languages" });
    expect(resume.skills.find((g) => g.items.some((i) => i.name === "Django"))?.group).toBe("Backend");
    expect(resume.skills.find((g) => g.items.some((i) => i.name === "PostgreSQL"))?.group).toBe("Data");
  });

  it("4e. knows where web, data, AI/ML and tool skills go", async () => {
    const { skillGroupOf } = await import("@/lib/tailor/validate");
    expect(skillGroupOf("Gemini API", "cloud")).toBe("Backend");
    expect(skillGroupOf("Firebase", "cloud")).toBe("Backend");
    expect(skillGroupOf("PyTorch", "library")).toBe("AI/ML");
    expect(skillGroupOf("scikit-learn", "library")).toBe("AI/ML");
    expect(skillGroupOf("Hugging Face Transformers", "library")).toBe("AI/ML");
    expect(skillGroupOf("NLP", "practice")).toBe("AI/ML");
    expect(skillGroupOf("multimodal deep learning", "domain")).toBe("AI/ML");
    expect(skillGroupOf("SHAP", "library")).toBe("AI/ML");
    expect(skillGroupOf("LaTeX", "language")).toBe("Infrastructure");
    expect(skillGroupOf("Chrome APIs", "tool")).toBe("Frontend");
    expect(skillGroupOf("Three.js", "library")).toBe("Frontend");
    expect(skillGroupOf("TypeScript", "language")).toBe("Languages");
    expect(skillGroupOf("PostgreSQL", "database")).toBe("Data");
    expect(skillGroupOf("Docker", "tool")).toBe("Infrastructure");
  });

  it("2c. lets a count become the list it counts", () => {
    expect(
      droppedDetails(
        "Built three-role access (admin, editor, viewer) on Firebase Auth",
        "Built role-based access control (admin, editor, viewer) with Firebase Auth",
        "",
        [["Firebase Auth"]],
      ),
    ).toEqual([]);
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
      r.experience[0].bullets[0] = { ...b, text: Array.from({ length: 60 }, () => b.text).join(" ") };
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
