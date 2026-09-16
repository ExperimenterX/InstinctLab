import type { ArchetypeManifest } from "@instinct/lab-schema";
import { NotImplemented } from "@instinct/shared";

/**
 * The shared system prompt for plan + both compose calls.
 *
 * CACHE LAYOUT MATTERS HERE. Render order is tools → system → messages, and caching is a prefix
 * match: one changed byte invalidates everything after it. So:
 *   [stable] DSL rules, archetype manifest, worked example, limits   ← cache_control here
 *   [volatile] the learner's concept, session hints                  ← user turn, after the break
 *
 * Never interpolate a timestamp, session id, or the concept into this string. Doing so gives
 * every request a unique prefix and silently disables caching for the whole product.
 * Verify with `usage.cache_read_input_tokens` — if it stays 0, something volatile leaked in.
 */
export function composerSystemPrompt(_manifest: ArchetypeManifest): string {
  // TODO(BACKEND): P2. Sections, in this order:
  //   1. Role: you author a LabSpec — a declarative simulation. You do not write prose.
  //   2. The DSL: doc 03 condensed. Expression scope + the closed function table verbatim.
  //   3. The archetype manifest, rendered from `_manifest` (generated, never hand-written).
  //   4. The worked example from doc 03 §10 — one, complete. Models match example structure
  //      closely, so this single example does more work than any amount of instruction.
  //   5. The bar (below).
  throw new NotImplemented("ai-core/composerSystemPrompt");
}

/**
 * The quality bar. Keep it short, positive, and mechanism-focused.
 *
 * Deliberately NOT written in the old style — no "CRITICAL: YOU MUST", no prohibition walls.
 * These models follow the system prompt closely, so emphasis written to overcome an older
 * model's reluctance now overtriggers, and a prohibition list anchors toward the behaviour it
 * names. State the target; give the reason.
 */
export const COMPOSER_BAR = `
A lab is not a diagram. The learner's input must feed back into the dynamics: at least one step
expression reads a param, transitively. Encode the teaching angle in the dynamics, not the caption.

Pick the knobs that test the teaching angle. Eight is the ceiling and rarely the right number —
two or three well-chosen knobs teach more than six.

The prediction must be falsifiable and not answerable from anything already on screen. A learner
who can read the answer off a caption has not predicted anything.

Captions are ≤ 90 characters and optional. If the lab needs prose to make its point, the
simulation is doing too little — fix the simulation.

Choose one of the nine real archetypes. Reach for free-canvas only when none of them can hold the
concept, and say why in the teaching angle.
`.trim();

/** Delimits learner text so it is read as content, never as instruction (see prompt-guard). */
export function userTurn(_concept: string, _extra?: Record<string, unknown>): string {
  // TODO(BACKEND): wrap in <learner_concept> … </learner_concept> + a line stating it is data
  throw new NotImplemented("ai-core/userTurn");
}
