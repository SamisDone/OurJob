import type { z } from "zod";

/** docs/ARCHITECTURE.md section 9. Every LLM call goes through this interface. */
export type GenerateArgs<T> = {
  /** Prompt id ("p1-profile"), for caching, fixtures and logs. */
  promptId: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  temperature?: number;
  maxOutputTokens?: number;
};

export type Usage = { inputTokens: number; outputTokens: number };

export interface LLMProvider {
  name: string;
  model: string;
  generateJSON<T>(args: GenerateArgs<T>): Promise<{ data: T; usage: Usage }>;
}

export type LLMErrorCode = "rate_limited" | "invalid_output" | "auth" | "unavailable" | "missing_fixture";

/** An LLM failure with copy that can be shown as is. Errors do not apologize. */
export class LLMError extends Error {
  constructor(
    public readonly code: LLMErrorCode,
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "LLMError";
  }
}
