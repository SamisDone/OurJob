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
