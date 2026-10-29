import { mkdtempSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { cachedGenerate, cacheKey, type CacheStore } from "@/lib/llm/cache";
import { createGeminiProvider, type GeminiOptions } from "@/lib/llm/gemini";
import { toGeminiSchema } from "@/lib/llm/json-schema";
import { createMockProvider, createRecordingProvider, promptHash } from "@/lib/llm/mock";
import { LLMError } from "@/lib/llm/types";
import { generateValidated, stripFences } from "@/lib/llm/validate";

const schema = z.object({ title: z.string(), skills: z.array(z.string()), remoteScopeText: z.string().optional() });
const realResponse = JSON.parse(readFileSync("tests/fixtures/llm/gemini/structured-response.json", "utf8"));

/** A fake SDK `models` returning the saved real gemini-3.8-flash response, or scripted errors. */
function fakeModels(script: (Error | object)[] = []) {
  const calls: { model: string; config: Record<string, unknown>; text: string }[] = [];
  const models = {
    async generateContent(req: {
      model: string;
      config: Record<string, unknown>;
      contents: { parts: { text: string }[] }[];
    }) {
      calls.push({ model: req.model, config: req.config, text: req.contents[0].parts[0].text });
      const next = script.shift() ?? realResponse;
      if (next instanceof Error) throw next;
      const r = next as { candidates: { content: { parts: { text: string }[] } }[] };
      return { ...r, text: r.candidates[0].content.parts.map((p) => p.text).join("") };
    },
  };
  return { calls, models: models as unknown as NonNullable<GeminiOptions["models"]> };
}

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });
const fast = { sleep: async () => {}, log: () => {} };

describe("toGeminiSchema", () => {
  it("keeps only keywords Gemini supports and makes defaulted fields optional", () => {
    const s = toGeminiSchema(
      z.object({
        name: z.string().min(2),
        tags: z.array(z.string()).default([]),
        kind: z.literal("cv"),
        level: z.enum(["mid", "senior"]).optional(),
      }),
    );
    const text = JSON.stringify(s);
    expect(text).not.toMatch(/"\$schema"|"default"|"minLength"|"const"/);
    expect((s.properties as Record<string, { enum?: unknown[] }>).kind.enum).toEqual(["cv"]);
    expect(s.required).toEqual(["name", "kind"]);
  });
});

describe("generateValidated", () => {
  it("asks once more with the validation errors, then succeeds", async () => {
    const prompts: string[] = [];
    const answers = ['{"title": 3}', '{"title":"Go engineer","skills":["Go"]}'];
    const res = await generateValidated(schema, "USER", async (user) => {
      prompts.push(user);
      return { text: answers.shift()!, usage: { inputTokens: 10, outputTokens: 5 } };
    });
    expect(res.data.title).toBe("Go engineer");
    expect(res.usage).toEqual({ inputTokens: 20, outputTokens: 10 });
    expect(prompts[1]).toContain("did not match the schema");
    expect(prompts[1]).toContain("title");
  });

  it("gives up with a clear error after the second bad answer", async () => {
    await expect(
      generateValidated(schema, "USER", async () => ({ text: "not json", usage: { inputTokens: 0, outputTokens: 0 } })),
    ).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("strips code fences around JSON", () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
});

describe("Gemini provider (against a saved real gemini-3.8-flash response)", () => {
  it("sends JSON mode, the schema and the system prompt, and reads text and usage", async () => {
    const f = fakeModels();
    const p = createGeminiProvider({ apiKey: "test", model: "gemini-3.8-flash", models: f.models, ...fast });
    const res = await p.generateJSON({ promptId: "smoke", system: "SYS", user: "USER", schema, temperature: 0.1 });
    expect(res.data).toEqual({
      title: "Senior Go engineer",
      skills: ["Go", "PostgreSQL", "Kafka"],
      remoteScopeText: "Remote within EU",
    });
    // Thinking tokens count toward output: 24 visible + 303 thoughts in the saved response.
    expect(res.usage).toEqual({ inputTokens: 47, outputTokens: 327 });
    expect(f.calls[0].model).toBe("gemini-3.8-flash");
    expect(f.calls[0].config).toMatchObject({
      systemInstruction: "SYS",
      temperature: 0.1,
      responseMimeType: "application/json",
    });
    expect(f.calls[0].config.responseJsonSchema).toBeTruthy();
  });

  it("retries a busy model, then falls back to the lite model", async () => {
    const f = fakeModels([httpError(503), httpError(503), httpError(503), httpError(503)]);
    const p = createGeminiProvider({
      apiKey: "test",
      model: "gemini-3.8-flash",
      fallbackModel: "gemini-3.5-flash-lite",
      models: f.models,
      ...fast,
    });
    const res = await p.generateJSON({ promptId: "smoke", system: "S", user: "U", schema });
    expect(res.data.title).toBe("Senior Go engineer");
    expect(f.calls.map((c) => c.model)).toEqual([
      "gemini-3.8-flash",
      "gemini-3.8-flash",
      "gemini-3.8-flash",
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite",
    ]);
  });

  it("explains a rate limit when there is no fallback", async () => {
    const f = fakeModels(Array.from({ length: 4 }, () => httpError(429)));
    const p = createGeminiProvider({ apiKey: "test", model: "gemini-3.8-flash", models: f.models, ...fast });
    await expect(p.generateJSON({ promptId: "x", system: "S", user: "U", schema })).rejects.toMatchObject({
      code: "rate_limited",
      message: "Gemini's rate limit was reached. Wait about a minute, or try again now.",
    });
  });

  it("skips retries on a used-up daily quota and falls back at once", async () => {
    const body = readFileSync("tests/fixtures/llm/gemini/daily-quota-429.json", "utf8");
    const daily = () => Object.assign(new Error(body), { status: 429 });
    const f = fakeModels([daily()]);
    const p = createGeminiProvider({
      apiKey: "test",
      model: "gemini-3.8-flash",
      fallbackModel: "gemini-3.5-flash-lite",
      models: f.models,
      ...fast,
    });
    await p.generateJSON({ promptId: "x", system: "S", user: "U", schema });
    expect(f.calls.map((c) => c.model)).toEqual(["gemini-3.8-flash", "gemini-3.5-flash-lite"]);

    const alone = createGeminiProvider({
      apiKey: "test",
      model: "gemini-3.8-flash",
      models: fakeModels([daily()]).models,
      ...fast,
    });
    await expect(alone.generateJSON({ promptId: "x", system: "S", user: "U", schema })).rejects.toMatchObject({
      code: "rate_limited",
      message: "Gemini's free daily limit for this model is used up. It resets in about 17 hours.",
      retryAfterMs: 60_657_000,
    });
  });

  it("does not retry or fall back on a rejected key", async () => {
    const f = fakeModels([httpError(401)]);
    const p = createGeminiProvider({
      apiKey: "bad",
      model: "gemini-3.8-flash",
      fallbackModel: "gemini-3.5-flash-lite",
      models: f.models,
      ...fast,
    });
    await expect(p.generateJSON({ promptId: "x", system: "S", user: "U", schema })).rejects.toMatchObject({
      code: "auth",
    });
    expect(f.calls).toHaveLength(1);
  });

  it("never logs prompt text", async () => {
    const logs: unknown[] = [];
    const f = fakeModels();
    const p = createGeminiProvider({
      apiKey: "t",
      model: "m",
      models: f.models,
      sleep: async () => {},
      log: (e) => logs.push(e),
    });
    await p.generateJSON({ promptId: "p1-profile", system: "S", user: "SECRET CV TEXT", schema });
    expect(JSON.stringify(logs)).not.toContain("SECRET CV TEXT");
    expect(logs[0]).toMatchObject({ promptId: "p1-profile", model: "m" });
  });
});

describe("mock provider", () => {
  const dir = mkdtempSync(join(tmpdir(), "ourjob-llm-"));
  mkdirSync(join(dir, "demo"));
  writeFileSync(
    join(dir, "demo", "a.json"),
    JSON.stringify({ match: ["Go engineer"], output: { title: "From match", skills: [] } }),
  );
  writeFileSync(
    join(dir, "demo", `${promptHash("SYS", "exact prompt")}.json`),
    JSON.stringify({ output: { title: "From hash", skills: ["Go"] } }),
  );
  const mock = createMockProvider(dir);

  it("prefers an exact recording of the prompt", async () => {
    expect(
      (await mock.generateJSON({ promptId: "demo", system: "SYS", user: "exact prompt", schema })).data.title,
    ).toBe("From hash");
  });

  it("falls back to a fixture whose match strings appear in the prompt", async () => {
    expect(
      (await mock.generateJSON({ promptId: "demo", system: "S", user: "a Go engineer job", schema })).data.title,
    ).toBe("From match");
  });

  it("says which file to add when nothing matches", async () => {
    await expect(mock.generateJSON({ promptId: "demo", system: "S", user: "nothing", schema })).rejects.toBeInstanceOf(
      LLMError,
    );
  });

  it("validates mock answers like real ones", async () => {
    writeFileSync(join(dir, "demo", "z-bad.json"), JSON.stringify({ match: ["broken"], output: { title: 1 } }));
    await expect(mock.generateJSON({ promptId: "demo", system: "S", user: "broken", schema })).rejects.toMatchObject({
      code: "invalid_output",
    });
  });

  it("records real answers as exact-hash fixtures", async () => {
    const out = mkdtempSync(join(tmpdir(), "ourjob-rec-"));
    const rec = createRecordingProvider(
      createGeminiProvider({ apiKey: "t", model: "m", models: fakeModels().models, ...fast }),
      out,
    );
    await rec.generateJSON({ promptId: "smoke", system: "S", user: "U", schema });
    expect(readdirSync(join(out, "smoke"))).toEqual([`${promptHash("S", "U")}.json`]);
  });
});

describe("llm cache", () => {
  const memory = (): CacheStore & { map: Map<string, unknown> } => {
    const map = new Map<string, unknown>();
    return { map, get: async (k) => map.get(k), set: async (k, v) => void map.set(k, v) };
  };

  it("pays for the same prompt only once", async () => {
    const store = memory();
    const f = fakeModels();
    const p = createGeminiProvider({ apiKey: "t", model: "m", models: f.models, ...fast });
    const args = { promptId: "x", system: "S", user: "U", schema };
    const a = await cachedGenerate(p, store, "v1", args);
    const b = await cachedGenerate(p, store, "v1", args);
    expect(a.cached).toBe(false);
    expect(b.cached).toBe(true);
    expect(b.data).toEqual(a.data);
    expect(f.calls).toHaveLength(1);
  });

  it("keys on prompt version and model, so a prompt change is a new entry", () => {
    const base = { promptId: "p1", promptVersion: "v1", model: "m", system: "S", user: "U" };
    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, promptVersion: "v2" }));
    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, model: "other" }));
  });
});
