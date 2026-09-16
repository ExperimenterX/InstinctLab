import type { Domain, EffectiveLimits, LabPlan } from "@instinct/lab-schema";
import { NotImplemented, type Result } from "@instinct/shared";

/**
 * Stage 1. Fast, small, structured. Its only job is the single highest-leverage decision in the
 * product: **which archetype, and what is the one insight this lab exists to deliver.**
 *
 * It must return in ~1s so the client can render a shell and skeleton canvas inside the 2.5s
 * first-visual budget (doc 00 §7). Everything else waits.
 */
export interface PlanInput {
  concept: string;
  hints?: { domain?: Domain; difficulty?: 1 | 2 | 3 | 4 | 5; priorKnowledge?: string };
  limits: EffectiveLimits;
  /** Present on a remix — "harder" means harder than what THIS learner demonstrated. */
  parentTranscriptDigest?: unknown;
  remixIntent?: "harder" | "simpler" | "different-angle" | "different-archetype";
}

export type PlanOutcome =
  | { kind: "plan"; plan: LabPlan }
  /** Too vague to simulate. Ask ONE question — never guess (doc 08 adversarial table). */
  | { kind: "clarify"; question: string }
  /** Not simulable, or declined. `alternative` is the nearest concept we CAN build. */
  | { kind: "decline"; reason: string; alternative: string | null };

export async function plan(_input: PlanInput): Promise<Result<PlanOutcome, Error>> {
  // TODO(BACKEND): P1. generateStructured with the planner model + PlanOutcome schema.
  // Inject the live archetype manifest (GET /api/archetypes) into the system prompt — never a
  // hand-maintained list, or the prompt and FRONTEND's renderers drift apart (doc 02).
  throw new NotImplemented("ai-core/plan");
}
