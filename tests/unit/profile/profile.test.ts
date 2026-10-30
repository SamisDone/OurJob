import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractUpload } from "@/lib/ingest/files";
import type { CacheStore } from "@/lib/llm/cache";
import { createMockProvider } from "@/lib/llm/mock";
import { p1OutputSchema } from "@/lib/llm/prompts/p1-profile";
import { buildProfile, draftSearchPreferences, suggestSearchPreferences } from "@/lib/profile/build";
import { compareProfile, type ExpectedFacts } from "@/lib/profile/compare";
import { formatCvDate, parseCvDate } from "@/lib/profile/dates";
import { normalizeProfile } from "@/lib/profile/normalize";
import { masterProfileSchema } from "@/lib/profile/schema";
import { canonicalSkill, mentions } from "@/lib/profile/skills";

const memoryCache = (): CacheStore => {
  const m = new Map<string, unknown>();
  return { get: async (k) => m.get(k), set: async (k, v) => void m.set(k, v) };
};
const deps = () => ({ provider: createMockProvider(), cache: memoryCache() });
const fixture = (p: string) => new Uint8Array(readFileSync(`tests/fixtures/${p}`));
const expected = (name: string) =>
  JSON.parse(readFileSync(`tests/fixtures/expected/${name}.json`, "utf8")) as ExpectedFacts;
const rawP1 = (name: string) =>
  p1OutputSchema.parse(JSON.parse(readFileSync(`tests/fixtures/llm/p1-profile/${name}.json`, "utf8")).output);

describe("CV dates", () => {
  it.each([
    ["Mar 2024", "2024-03"],
    ["March 2024", "2024-03"],
    ["Sept 2021", "2021-09"],
    ["June 2023", "2023-06"],
    ["2024-3", "2024-03"],
    ["03/2024", "2024-03"],
    ["2019", "2019"],
    ["Present", "present"],
    ["current", "present"],
    ["Marching 2024", null],
    ["13/2024", null],
    ["", null],
  ])("parses %j", (input, out) => expect(parseCvDate(input)).toBe(out));

  it("formats for display", () => {
    expect(formatCvDate("2024-03")).toBe("Mar 2024");
    expect(formatCvDate("present")).toBe("Present");
    expect(formatCvDate("2019")).toBe("2019");
  });
});

describe("skills", () => {
  it("maps spellings to canonical names", () => {
    expect(canonicalSkill("Postgres")).toBe("PostgreSQL");
    expect(canonicalSkill("golang")).toBe("Go");
    expect(canonicalSkill("NextJS")).toBe("Next.js");
    expect(canonicalSkill("Leaflet")).toBe("Leaflet");
  });

  it("matches on word boundaries", () => {
    expect(mentions("Java and Spring", "Java")).toBe(true);
    expect(mentions("JavaScript apps", "Java")).toBe(false);
    expect(mentions("C++ and C#", "C")).toBe(false);
    expect(mentions("Built with React.", "React")).toBe(true);
  });
});

describe("normalizeProfile", () => {
  const p = normalizeProfile(rawP1("nadia-chowdhury"));

  it("produces a valid MasterProfile with stable ids", () => {
    expect(() => masterProfileSchema.parse(p)).not.toThrow();
    expect(p.experience.map((e) => e.id)).toEqual(["exp_1", "exp_2"]);
    expect(p.experience[0].bullets.map((b) => b.id)).toEqual(["b_1_1", "b_1_2", "b_1_3"]);
    expect(p.projects[0].id).toBe("proj_1");
    expect(p.projects[0].bullets[0].id).toBe("b_p1_1");
    expect(normalizeProfile(rawP1("nadia-chowdhury"))).toEqual(p);
  });

  it("normalizes dates", () => {
    expect(p.experience.map((e) => [e.start, e.end])).toEqual([
      ["2023-06", "present"],
      ["2020-02", "2023-05"],
    ]);
  });

  it("turns ** markers into bold phrases and keeps only phrases in the text", () => {
    const b = p.experience[0].bullets[0];
    expect(b.text).not.toContain("**");
    expect(b.boldPhrases).toContain("rate-quote service");
  });

  it("drops metrics that are not in the bullet and keeps hedges that are", () => {
    const billing = p.experience[0].bullets[1];
    expect(billing.metrics).toEqual([{ value: "60%", hedge: "roughly" }]);
  });

  it("merges skill spellings into one canonical skill", () => {
    const pg = p.skills.filter((s) => s.name === "PostgreSQL");
    expect(pg).toHaveLength(1);
    expect(pg[0].aliases).toContain("Postgres");
    expect(p.skills.some((s) => s.name === "Golang")).toBe(false);
    expect(p.skills.find((s) => s.name === "Go")?.id).toBe("sk_go");
  });

  it("computes evidence from the text, not from the model", () => {
    const pg = p.skills.find((s) => s.name === "PostgreSQL")!;
    expect(pg.evidence).toContain("b_2_3"); // "Added Postgres row-level security"
    expect(pg.evidence).toContain("proj_1"); // pgwatch-lite tech
    expect(p.skills.find((s) => s.name === "Terraform")!.evidence).toEqual([]); // only listed on LinkedIn
  });

  it("points conflicts at the item they belong to, with dates normalized", () => {
    expect(p.conflicts).toEqual([
      {
        field: "experience.exp_2.end",
        values: [
          { value: "2023-05", source: "cv" },
          { value: "2023-04", source: "linkedin" },
        ],
      },
    ]);
  });
});

describe("each fixture CV produces a complete profile (Phase 1 done criterion)", () => {
  it.each([
    [
      "nadia-chowdhury",
      [
        ["cvs/nadia-chowdhury.md", false],
        ["linkedin/nadia-chowdhury-linkedin.pdf", true],
      ],
    ],
    ["tomas-herrera", [["cvs/tomas-herrera.docx", false]]],
    ["mei-lin-tan", [["cvs/mei-lin-tan.pdf", false]]],
  ] as const)("%s", async (name, files) => {
    const sources = [];
    for (const [file, linkedin] of files) {
      const r = await extractUpload(file.split("/").pop()!, fixture(file), { linkedin });
      sources.push({ kind: r.kind, text: r.text });
    }
    const { profile } = await buildProfile(sources, deps());
    expect(compareProfile(profile, expected(name))).toEqual([]);
  });

  it("copies the email from the CV text when the model leaves it out", async () => {
    const { profile } = await buildProfile([{ kind: "cv_md", text: "# Mei Lin Tan\nmeilin.tan@example.com\nReact" }], {
      provider: {
        name: "fake",
        model: "fake",
        generateJSON: async ({ schema }) => ({
          data: schema.parse({ basics: { name: "Mei Lin Tan" } }),
          usage: { inputTokens: 0, outputTokens: 0 },
        }),
      },
      cache: memoryCache(),
    });
    expect(profile.basics.email).toBe("meilin.tan@example.com");
  });

  it("needs a CV before anything else", async () => {
    await expect(buildProfile([{ kind: "github", text: "x" }], deps())).rejects.toThrow("A CV is needed");
  });
});

describe("P5 search suggestions", () => {
  it("keeps only core skills that are in the profile", async () => {
    const profile = normalizeProfile(rawP1("nadia-chowdhury"));
    const s = await suggestSearchPreferences(profile, deps());
    expect(s.targetTitles[0]).toBe("Backend Engineer");
    expect(s.coreSkills).toContain("Go");
    expect(s.coreSkills).not.toContain("Rust");
    expect(s.seniority).toEqual(["mid", "senior"]);
  });
});

describe("search preferences draft (shown at once, before P5)", () => {
  it("uses his own titles newest first, his best-evidenced skills and his years", () => {
    const profile = normalizeProfile(rawP1("nadia-chowdhury"));
    const d = draftSearchPreferences(profile, new Date("2026-10-30"));
    expect(d.targetTitles).toEqual(["Senior Backend Engineer", "Backend Developer"]);
    expect(d.coreSkills.length).toBeGreaterThan(3);
    expect(d.coreSkills.length).toBeLessThanOrEqual(10);
    expect(d.coreSkills.every((s) => profile.skills.some((p) => p.name === s))).toBe(true);
    // Feb 2020 to now is more than 6 years.
    expect(d.seniority).toEqual(["senior"]);
  });

  it("is empty but valid for a profile with no roles", () => {
    const profile = normalizeProfile(rawP1("nadia-chowdhury"));
    const d = draftSearchPreferences({ ...profile, experience: [], skills: [] });
    expect(d).toEqual({ targetTitles: [], coreSkills: [], seniority: ["intern", "junior"] });
  });
});
