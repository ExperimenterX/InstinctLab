import { NotImplemented } from "@instinct/shared";

/**
 * Hard ceilings on spend and time per session. A runaway generation loop is a bill, and a
 * runaway coach is a bill that arrives once per learner interaction.
 */
export interface Budget {
  /** Throws AppError("RATE_LIMITED") when the session has spent its allowance. */
  charge(stage: "plan" | "compose" | "repair" | "coach" | "quiz" | "grade", tokens: number): void;
  remaining(): number;
  spent(): number;
}

export function createBudget(_sessionId: string, _maxTokens: number): Budget {
  // TODO(BACKEND): P5. Accumulate usage.input_tokens + output_tokens per call.
  // Note `input_tokens` is only the UNCACHED remainder — total is
  // input + cache_creation_input_tokens + cache_read_input_tokens. Summing the wrong field
  // under-reports by most of the prompt on a cache hit.
  throw new NotImplemented("ai-core/createBudget");
}

/**
 * Cache health check. If `cache_read_input_tokens` stays 0 across repeated generations,
 * something volatile leaked into the system prompt prefix and every request is paying full
 * price. Log it loudly — it's invisible otherwise.
 */
export function assertCacheHealthy(_usage: {
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}): void {
  // TODO(BACKEND): P5
  throw new NotImplemented("ai-core/assertCacheHealthy");
}
