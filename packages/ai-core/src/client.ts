import Anthropic from "@anthropic-ai/sdk";
import { NotImplemented } from "@instinct/shared";

/**
 * One shared client. The zero-arg constructor resolves credentials from the environment
 * (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile) — do not hardcode
 * a key, and do not read the env var anywhere outside this package.
 */
let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

/**
 * A refusal arrives as a successful HTTP 200 with `stop_reason: "refusal"`, not an exception.
 * Code that reads `content[0]` unconditionally breaks on one — check this first, always.
 *
 * For us this is mostly benign: a learner asking about a dual-use mechanism can trip a
 * classifier. The product answer is doc 08's — decline the lab, offer the underlying concept.
 */
export function isRefusal(res: { stop_reason?: string | null }): boolean {
  return res.stop_reason === "refusal";
}

export interface CallOptions {
  model: string;
  maxTokens: number;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  timeoutMs: number;
  signal?: AbortSignal;
}

/**
 * Structured generation. `output_config.format` from a Zod schema is how we get a valid
 * LabSpec — the model is constrained to the shape, so the old "parse JSON and hope" path and
 * most of the repair loop disappear.
 *
 * API's schemas ARE the output format. That's the payoff of the contract-first design: one
 * definition validates the model, the API, and the client.
 *
 * Caveats the SDK handles for us but BACKEND must know about:
 *  - numeric/length constraints (`.min()`, `.max()`) are stripped from the schema sent to the
 *    API and validated client-side instead. So LIMITS are NOT enforced by the constrained
 *    decode — `validateLabSpec` is still mandatory.
 *  - recursive schemas are unsupported. LabSpec isn't recursive; keep it that way.
 *  - incompatible with citations, and with a message prefill (which is already forbidden).
 */
export async function generateStructured<T>(
  _opts: CallOptions & {
    system: string;
    userContent: string;
    /** Zod schema; wrap with `zodOutputFormat` from "@anthropic-ai/sdk/helpers/zod". */
    schema: unknown;
    /** Cache the system prompt prefix. Worth it whenever `system` exceeds ~512 tokens. */
    cacheSystem?: boolean;
  },
): Promise<{ value: T; refused: boolean }> {
  // TODO(BACKEND): client.messages.parse({ model, max_tokens, thinking: THINKING,
  //   output_config: { effort, format: zodOutputFormat(schema) }, system: [...], messages: [...] })
  //   → check isRefusal → return res.parsed_output (nullable! guard it)
  throw new NotImplemented("ai-core/generateStructured");
}

/**
 * Streaming text generation, for the coach. Use `.stream()` + `.finalMessage()`; never hand-roll
 * a promise around `.on()` events.
 */
export async function generateText(
  _opts: CallOptions & { system: string; userContent: string; cacheSystem?: boolean },
): Promise<{ text: string; refused: boolean }> {
  // TODO(BACKEND)
  throw new NotImplemented("ai-core/generateText");
}
