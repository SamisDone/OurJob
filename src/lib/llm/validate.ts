import type { z } from "zod";
import { LLMError, type Usage } from "./types";

/**
 * Parses and validates model output. If it fails, asks once more with the
 * validation errors appended (docs/AI_PROMPTS.md); a second failure is an
 * LLMError the UI can show.
 */
export async function generateValidated<T>(
  schema: z.ZodType<T>,
  user: string,
  call: (user: string) => Promise<{ text: string; usage: Usage }>,
): Promise<{ data: T; usage: Usage }> {
  const total: Usage = { inputTokens: 0, outputTokens: 0 };
  let prompt = user;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, usage } = await call(prompt);
    total.inputTokens += usage.inputTokens;
    total.outputTokens += usage.outputTokens;
    let parsed: unknown;
    let problem: string;
    try {
      parsed = JSON.parse(stripFences(text));
      const result = schema.safeParse(parsed);
      if (result.success) return { data: result.data, usage: total };
      problem = result.error.issues
        .slice(0, 20)
        .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("\n");
    } catch {
      problem = "- The response was not valid JSON.";
    }
    prompt = `${user}\n\nYour previous answer did not match the schema. Fix these problems and answer again with JSON only:\n${problem}`;
  }
  throw new LLMError("invalid_output", "The model's answer did not match the expected format twice. Try again.");
}

/** Some models wrap JSON in ```json fences even when asked not to. */
export function stripFences(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return m ? m[1] : t;
}
