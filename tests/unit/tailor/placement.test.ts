import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { p1OutputSchema } from "@/lib/llm/prompts/p1-profile";
import { p3Prompt, placementHints } from "@/lib/llm/prompts/p3-tailor";
import { normalizeProfile } from "@/lib/profile/normalize";
import { copiedJobPhrase } from "@/lib/tailor/validate";

const profile = normalizeProfile(
  p1OutputSchema.parse(JSON.parse(readFileSync("tests/fixtures/llm/p1-profile/nadia-chowdhury.json", "utf8")).output),
);
const bullet = profile.experience[0].bullets[0];
const role = profile.experience[0];
const skill = profile.skills[0];

describe("placementHints", () => {
  it("offers a keyword only to the bullets whose own text proves it", () => {
    const { placement, techOnly } = placementHints(profile, [
      { term: "Kafka", canonical: "kafka", importance: "must", proofIds: [bullet.id, role.id, skill.id] },
    ]);
    expect(placement).toEqual({ [bullet.id]: ["Kafka"] });
    expect(techOnly).toEqual([]);
  });

  it("keeps keywords proven only by a tech line or skills out of bullets", () => {
    const { placement, techOnly } = placementHints(profile, [
      { term: "Docker", canonical: "docker", importance: "nice", proofIds: [role.id, skill.id] },
    ]);
    expect(placement).toEqual({});
    expect(techOnly).toEqual(["Docker"]);
  });

  it("sends both lists to the model", () => {
    const spec = {
      title: "Backend Engineer",
      company: "Lumen Labs",
      seniority: "senior",
      responsibilities: [],
      keywords: [],
    };
    const { user } = p3Prompt(
      profile,
      spec as never,
      [{ term: "Kafka", canonical: "kafka", importance: "must", proofIds: [bullet.id] }],
      [],
      { pages: 1, spelling: "US" },
    );
    expect(user).toContain(`<placement>{"${bullet.id}":["Kafka"]}</placement>`);
    expect(user).toContain("<tech_only>[]</tech_only>");
  });
});

describe("copiedJobPhrase (validator check 2b)", () => {
  const job =
    "You will ingest data from APIs, SFTP drops and Kafka topics, and build batch pipelines in Python for the finance team.";
  const source =
    "Moved nightly billing jobs from cron scripts to a Kafka-based event pipeline; cut failed runs by roughly 60%.";

  it("catches a job responsibility pasted into a bullet", () => {
    const text =
      "Ingest data from APIs, SFTP drops and Kafka topics by moving nightly billing jobs to a Kafka pipeline.";
    expect(copiedJobPhrase(text, source, job)).toBe("ingest data from apis sftp");
  });

  it("allows rewording that only uses words its source already has", () => {
    const text = "Moved nightly billing jobs to a Kafka-based event pipeline, cutting failed runs by roughly 60%.";
    expect(copiedJobPhrase(text, source, job)).toBeNull();
  });

  it("allows a job phrase made only of words the source uses", () => {
    expect(
      copiedJobPhrase(
        "Moved billing jobs to Kafka topics and the finance team pipeline.",
        `${source} topics finance team`,
        job,
      ),
    ).toBeNull();
  });
});

describe("job keywords his profile proves under another name", () => {
  it("matches authentication, role-based access control and LLM APIs to Firebase Auth, role access and the Gemini API", async () => {
    const { splitKeywords } = await import("@/lib/tailor/keywords");
    const { normalizeProfile } = await import("@/lib/profile/normalize");
    const { p1OutputSchema } = await import("@/lib/llm/prompts/p1-profile");
    const { readFileSync } = await import("node:fs");
    // Fictional profile with "role-based access (admin, editor, viewer) ... on Firebase Auth" and a Gemini API project.
    const profile = normalizeProfile(
      p1OutputSchema.parse(JSON.parse(readFileSync("tests/fixtures/llm/p1-profile/farhan-kabir.json", "utf8")).output),
    );
    const kw = (term: string, canonical: string) => ({
      term,
      canonical,
      synonyms: [],
      importance: "must" as const,
      kind: "hard_skill" as const,
      evidenceQuote: term,
    });
    const spec = {
      title: "Full Stack Developer",
      responsibilities: [],
      keywords: [
        kw("authentication", "Authentication"),
        kw("role-based access control", "Role-Based Access Control"),
        kw("LLM APIs", "Large language models"),
      ],
    };
    const { matched, gaps } = splitKeywords(spec as never, profile);
    expect(gaps.map((g) => g.term)).toEqual([]);
    expect(matched.map((m) => m.term)).toEqual(["authentication", "role-based access control", "LLM APIs"]);
  });
});

describe("placement asks for one job term per bullet", () => {
  it("picks the one the bullet states in other words, and skips terms it already says", async () => {
    const { placementHints } = await import("@/lib/llm/prompts/p3-tailor");
    const { normalizeProfile } = await import("@/lib/profile/normalize");
    const { p1OutputSchema } = await import("@/lib/llm/prompts/p1-profile");
    const { readFileSync } = await import("node:fs");
    const profile = normalizeProfile(
      p1OutputSchema.parse(JSON.parse(readFileSync("tests/fixtures/llm/p1-profile/farhan-kabir.json", "utf8")).output),
    );
    // b_1_1: "Built role-based access (admin, editor, viewer) for the publishing dashboard on Firebase Auth."
    const { placement } = placementHints(profile, [
      { term: "authentication", canonical: "Authentication", importance: "must", proofIds: ["b_1_1"] },
      {
        term: "role-based access control",
        canonical: "Role-based access control",
        importance: "must",
        proofIds: ["b_1_1"],
      },
      { term: "Firebase Auth", canonical: "Firebase Auth", importance: "nice", proofIds: ["b_1_1"] },
    ]);
    expect(placement.b_1_1).toEqual(["role-based access control"]);
  });
});

describe("project names count as proof", () => {
  it("matches a domain the project's name states (AI Healthcare Platform proves healthcare)", async () => {
    const { splitKeywords } = await import("@/lib/tailor/keywords");
    const { normalizeProfile } = await import("@/lib/profile/normalize");
    const { p1OutputSchema } = await import("@/lib/llm/prompts/p1-profile");
    const { readFileSync } = await import("node:fs");
    const raw = p1OutputSchema.parse(
      JSON.parse(readFileSync("tests/fixtures/llm/p1-profile/farhan-kabir.json", "utf8")).output,
    );
    raw.projects[0].name = "ReadAloud: AI Healthcare Platform";
    const profile = normalizeProfile(raw);
    const kw = {
      term: "healthcare",
      canonical: "healthcare",
      synonyms: [],
      importance: "nice" as const,
      kind: "domain" as const,
      evidenceQuote: "healthcare",
    };
    const { matched, gaps } = splitKeywords({ title: "x", responsibilities: [], keywords: [kw] } as never, profile);
    expect(gaps).toEqual([]);
    expect(matched[0].proofIds).toContain(profile.projects[0].id);
  });
});
