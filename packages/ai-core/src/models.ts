/**
 * Model + request-shape configuration.
 *
 * Read `docs/09-claude-api-notes.md` before changing anything here. Several parameters that
 * older code uses are now hard 400s on these models.
 */

export const MODELS = {
  /** Authors the LabSpec. The hardest reasoning task in the product. */
  composer: process.env["INSTINCT_MODEL_COMPOSER"] ?? "claude-opus-5",
  /** Picks the archetype and teaching angle. Small output, must be fast. */
  planner: process.env["INSTINCT_MODEL_PLANNER"] ?? "claude-sonnet-5",
  /** Called many times per session; latency-sensitive. */
  coach: process.env["INSTINCT_MODEL_COACH"] ?? "claude-sonnet-5",
  grader: process.env["INSTINCT_MODEL_GRADER"] ?? "claude-sonnet-5",
} as const;

/**
 * `effort` lives inside `output_config`, not top-level. Default is `high`.
 *
 * Per-stage rationale:
 *  - composer `xhigh` — authoring a correct, coupled simulation is the hardest call we make
 *  - planner `medium` — one structured decision, and it gates first-visual latency
 *  - coach `low` — ≤40 words, must land in under 2s
 */
export const EFFORT = {
  composer: "xhigh",
  planner: "medium",
  coach: "low",
  grader: "medium",
} as const;

/**
 * `max_tokens` caps thinking + response text TOGETHER, and thinking is on by default on
 * Opus 5 — so a tight budget truncates mid-spec. Stream anything above ~16k.
 */
export const MAX_TOKENS = {
  composer: 32_000,
  planner: 4_000,
  coach: 1_024,
  grader: 4_000,
} as const;

/**
 * FORBIDDEN request fields on these models — each is a 400, not a warning:
 *   temperature, top_p, top_k        (removed; steer with the prompt instead)
 *   thinking.budget_tokens           (removed; use output_config.effort)
 *   a trailing assistant-turn prefill (removed; use output_config.format)
 * And: thinking {type:"disabled"} is only legal at effort `high` or below.
 *
 * If a stage needs output variety, vary the prompt — there is no temperature knob any more.
 */
export const THINKING = { type: "adaptive" } as const;

export const TIMEOUTS_MS = {
  plan: Number(process.env["INSTINCT_SPEC_TIMEOUT_MS"] ?? 45_000),
  compose: Number(process.env["INSTINCT_SPEC_TIMEOUT_MS"] ?? 45_000),
  coach: Number(process.env["INSTINCT_COACH_TIMEOUT_MS"] ?? 8_000),
} as const;

export const MAX_REPAIR_ATTEMPTS = Number(process.env["INSTINCT_MAX_REPAIR_ATTEMPTS"] ?? 2);
