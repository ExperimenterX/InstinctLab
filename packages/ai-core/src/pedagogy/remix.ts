import type { LabSpec, RemixRequest, TranscriptDigest } from "@instinct/lab-schema";
import { NotImplemented, type Result } from "@instinct/shared";
import type { PlanInput } from "../pipeline/plan.js";

/**
 * A remix is a new session seeded from the parent's transcript, not a mutation of the parent.
 *
 * That's what makes "harder" meaningful: harder *than what this learner demonstrated*, rather
 * than harder in the abstract. A learner who nailed every prediction gets a coupled second
 * variable; one who struggled gets the same angle with fewer moving parts.
 */
export function remixPlanInput(
  _parentSpec: LabSpec,
  _digest: TranscriptDigest,
  _request: RemixRequest,
): PlanInput {
  // TODO(BACKEND): P5.
  //   harder              → keep archetype + angle, add a coupled variable, tighten tolerances
  //   simpler             → keep angle, remove coupling, widen tolerances, fewer knobs
  //   different-angle     → same concept, a different mechanism to be wrong about
  //   different-archetype → same concept, re-cast in another visual grammar
  throw new NotImplemented("ai-core/remixPlanInput");
}

/** Adjacent concepts for the recap's "what next". Cheap — derived from the plan, not a new call. */
export function suggestNextConcepts(_spec: LabSpec): Result<string[], Error> {
  // TODO(BACKEND): P5
  throw new NotImplemented("ai-core/suggestNextConcepts");
}
